import { BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { Value } from '@sinclair/typebox/value';
import {
  PageWindowSchema,
  type PageWindowInput,
  type PreviewSnapshot,
} from '@origamix/shared/page-window';
import {
  isApiResultEnvelope,
  type PageRecord,
  type WorkspaceRecord,
} from '@origamix/shared/protocol/api';

interface PreviewEntry {
  window: BrowserWindow;
  target: PageWindowInput;
}

export function registerPageWindows(
  getConnection: () => { baseUrl: string; token: string; serviceInstanceId: string },
  getRendererPath: () => string,
): void {
  const windows = new Map<string, PreviewEntry>();
  const pending = new Map<string, Promise<void>>();
  const read = async <T>(path: string, projectId?: string): Promise<T> => {
    const connection = getConnection();
    const response = await fetch(`${connection.baseUrl}${path}`, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${connection.token}`,
        'x-origamix-service': connection.serviceInstanceId,
        ...(projectId ? { 'x-origamix-project-id': projectId } : {}),
      },
    });
    const result = await response.json();
    if (!isApiResultEnvelope(result)) throw new Error('服务返回格式无效');
    if (!result.success) throw new Error(result.message ?? `请求失败（${result.code}）`);
    return result.data as T;
  };

  ipcMain.handle('preview:read-snapshot', async (event): Promise<PreviewSnapshot> => {
    const entry = [...windows.values()].find(({ window }) => window.webContents === event.sender);
    if (!entry || event.senderFrame !== event.sender.mainFrame) throw new Error('预览窗口未授权');
    const target = entry.target;
    const [snapshot, workspace] = await Promise.all([
      read<Omit<PreviewSnapshot, 'theme'>>(`/pages/${target.pageId}/schema`, target.projectId),
      read<WorkspaceRecord>('/workspace'),
    ]);
    return { ...snapshot, theme: workspace.theme };
  });

  const openPreview = async (input: PageWindowInput): Promise<void> => {
    const pages = await read<PageRecord[]>(`/projects/${input.projectId}/pages`);
    const page = pages.find((item) => item.id === input.pageId);
    if (!page) throw new Error('页面不存在');
    const key = input.projectId;
    let entry = windows.get(key);
    const created = !entry || entry.window.isDestroyed();
    if (created) {
      const window = new BrowserWindow({
        width: 1100,
        height: 800,
        minWidth: 640,
        minHeight: 480,
        show: false,
        title: `${page.name} - 预览`,
        autoHideMenuBar: true,
        webPreferences: {
          preload: join(__dirname, '../preload/preview.cjs'),
          partition: `origamix-preview-${key}`,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      entry = { window, target: input };
      windows.set(key, entry);
      window.on('closed', () => windows.delete(key));
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      window.webContents.on('will-navigate', (event) => event.preventDefault());
      window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
        callback(false),
      );
    }
    if (!entry) return;
    const { window } = entry;
    if (created || entry.target.pageId !== input.pageId) {
      entry.target = input;
      window.setTitle(`${page.name} - 预览`);
      const query = { ...input, pageName: page.name };
      try {
        const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
        if (rendererUrl) {
          const url = new URL(rendererUrl);
          url.search = new URLSearchParams(query).toString();
          await window.loadURL(url.toString());
        } else {
          await window.loadFile(getRendererPath(), { query });
        }
      } catch (error) {
        if (!window.isDestroyed()) window.destroy();
        throw error;
      }
    }
    if (!window.isDestroyed()) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    }
  };

  ipcMain.handle('window:open-page', async (_event, input: unknown) => {
    if (!Value.Check(PageWindowSchema, input)) throw new Error('页面窗口参数无效');
    // Serialize concurrent clicks for a project; other projects remain independent.
    const operation = (pending.get(input.projectId) ?? Promise.resolve())
      .catch(() => undefined)
      .then(() => openPreview(input));
    pending.set(input.projectId, operation);
    try {
      await operation;
    } finally {
      if (pending.get(input.projectId) === operation) pending.delete(input.projectId);
    }
  });
}
