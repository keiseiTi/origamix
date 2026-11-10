import { BrowserWindow, session } from 'electron';
import { randomUUID } from 'node:crypto';
import type { BackendConnection, ProjectPreviewLaunch } from '@origamix/shared';

/** Main owns windows/cookies only. Server owns authorized project reads and preview sessions. */
export class ProjectPreviewWindows {
  private readonly entries = new Map<
    string,
    { window: BrowserWindow; launch: ProjectPreviewLaunch; timer: NodeJS.Timeout }
  >();
  private stopped = false;
  private readonly opening = new Map<string, Promise<void>>();
  constructor(private readonly connection: () => Promise<BackendConnection>) {}
  private request = async <T>(path: string, body: unknown): Promise<T> => {
    const backend = await this.connection();
    const response = await fetch(`${backend.baseUrl}/projects/preview/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${backend.token}`,
        'X-Origamix-Service': backend.serviceInstanceId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const result = (await response.json()) as { success: boolean; data: T; message: string };
    if (!response.ok || !result.success) throw new Error(result.message || '项目预览无法启动');
    return result.data;
  };
  open = (projectId: string): Promise<void> => {
    if (this.stopped) return Promise.reject(new Error('应用正在关闭'));
    if (!/^project_[A-Za-z0-9_-]+$/.test(projectId))
      return Promise.reject(new Error('项目 ID 无效'));
    const existing = this.entries.get(projectId);
    if (existing && !existing.window.isDestroyed()) {
      existing.window.show();
      existing.window.focus();
      return Promise.resolve();
    }
    const pending = this.opening.get(projectId);
    if (pending) return pending;
    const operation = this.create(projectId).finally(() => this.opening.delete(projectId));
    this.opening.set(projectId, operation);
    return operation;
  };
  private create = async (projectId: string): Promise<void> => {
    const launch = await this.request<ProjectPreviewLaunch>('open', { projectId });
    if (this.stopped) {
      await this.request('close', { sessionId: launch.sessionId, projectId }).catch(
        () => undefined,
      );
      return;
    }
    const origin = new URL(launch.url);
    if (
      origin.protocol !== 'http:' ||
      origin.hostname !== '127.0.0.1' ||
      origin.pathname !== '/__origamix/preview' ||
      launch.projectId !== projectId ||
      !/^[a-f0-9]{64}$/.test(launch.cookie)
    )
      throw new Error('项目预览返回了无效的会话');
    const partition = session.fromPartition(`origamix-preview-${randomUUID()}`);
    let window: BrowserWindow | undefined;
    try {
      await partition.cookies.set({
        url: origin.origin,
        name: 'origamix_preview',
        value: launch.cookie,
        httpOnly: true,
        sameSite: 'strict',
        path: '/__origamix/',
      });
      partition.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
      window = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 480,
        minHeight: 400,
        title: '项目预览',
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
          session: partition,
          sandbox: true,
          nodeIntegration: false,
          contextIsolation: true,
        },
      });
      const owned = window;
      owned.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      const local = (url: string) => {
        try {
          return new URL(url).origin === origin.origin;
        } catch {
          return false;
        }
      };
      owned.webContents.on('will-navigate', (event, url) => {
        if (!local(url)) event.preventDefault();
      });
      owned.webContents.on('will-frame-navigate', (event) => {
        if (!local(event.url)) event.preventDefault();
      });
      owned.webContents.on('will-redirect', (event, url) => {
        if (!local(url)) event.preventDefault();
      });
      let checking = false;
      const timer = setInterval(() => {
        if (checking || owned.isDestroyed()) return;
        checking = true;
        void this.request<{ active: boolean }>('status', { sessionId: launch.sessionId, projectId })
          .then((status) => {
            if (!status.active && !owned.isDestroyed()) owned.close();
          })
          .catch(() => {
            if (!owned.isDestroyed()) owned.close();
          })
          .finally(() => {
            checking = false;
          });
      }, 2000);
      this.entries.set(projectId, { window: owned, launch, timer });
      owned.once('closed', () => {
        clearInterval(timer);
        this.entries.delete(projectId);
        void partition.clearStorageData();
        void this.request('close', { sessionId: launch.sessionId, projectId }).catch(
          () => undefined,
        );
      });
      await owned.loadURL(launch.url);
      owned.show();
    } catch (error) {
      window?.destroy();
      await this.request('close', { sessionId: launch.sessionId, projectId }).catch(
        () => undefined,
      );
      throw error;
    }
  };
  close = () => {
    this.stopped = true;
    for (const entry of this.entries.values()) entry.window.destroy();
  };
}
