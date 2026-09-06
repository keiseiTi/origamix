import { BrowserWindow, ipcMain, WebContentsView } from 'electron';
import { join } from 'node:path';
import { Value } from '@sinclair/typebox/value';
import {
  PageWindowSchema,
  type PageWindowInput,
  type PreviewBounds,
  PreviewBoundsSchema,
  type PreviewSnapshot,
} from '@origamix/shared/page-window';
import {
  isApiResultEnvelope,
  type PageRecord,
  type WorkspaceRecord,
} from '@origamix/shared/protocol/api';

interface PreviewEntry {
  view: WebContentsView;
  target: PageWindowInput;
}

export function registerPageWindows(
  getConnection: () =>
    | { baseUrl: string; token: string; serviceInstanceId: string }
    | Promise<{ baseUrl: string; token: string; serviceInstanceId: string }>,
  getRendererPath: () => string,
  getWorkbenchWindow: () => BrowserWindow | undefined,
): void {
  const views = new Map<string, PreviewEntry>();
  const pending = new Map<string, Promise<void>>();
  let activeKey: string | undefined;
  let boundWindow: BrowserWindow | undefined;
  let previewBounds: PreviewBounds = { x: 0, y: 0, width: 1, height: 1 };

  const read = async <T>(path: string, projectId?: string): Promise<T> => {
    const connection = await getConnection();
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

  const keyOf = (target: PageWindowInput): string => `${target.projectId}:${target.pageId}`;
  const resizeActiveView = (): void => {
    const window = getWorkbenchWindow();
    const entry = activeKey ? views.get(activeKey) : undefined;
    if (!window || window.isDestroyed() || !entry) return;
    const [windowWidth, windowHeight] = window.getContentSize();
    entry.view.setBounds({
      x: previewBounds.x,
      y: previewBounds.y,
      width: Math.max(1, Math.min(previewBounds.width, windowWidth - previewBounds.x)),
      height: Math.max(1, Math.min(previewBounds.height, windowHeight - previewBounds.y)),
    });
  };
  const bindWindowLifecycle = (window: BrowserWindow): void => {
    if (boundWindow === window) return;
    boundWindow = window;
    window.on('resize', resizeActiveView);
    window.on('closed', () => {
      for (const { view } of views.values()) view.webContents.close();
      views.clear();
      activeKey = undefined;
      boundWindow = undefined;
    });
  };
  const exitPreview = (entry: PreviewEntry): void => {
    const window = getWorkbenchWindow();
    const key = keyOf(entry.target);
    if (window && !window.isDestroyed() && activeKey === key) {
      window.contentView.removeChildView(entry.view);
      activeKey = undefined;
      window.webContents.send('preview:exited', entry.target);
    }
  };
  const destroyPreview = (entry: PreviewEntry): void => {
    const window = getWorkbenchWindow();
    const key = keyOf(entry.target);
    if (window && !window.isDestroyed() && activeKey === key) {
      window.contentView.removeChildView(entry.view);
      activeKey = undefined;
    }
    views.delete(key);
    entry.view.webContents.close();
  };

  ipcMain.handle('preview:read-snapshot', async (event): Promise<PreviewSnapshot> => {
    const entry = [...views.values()].find(({ view }) => view.webContents === event.sender);
    if (!entry || event.senderFrame !== event.sender.mainFrame) throw new Error('预览视图未授权');
    const { target } = entry;
    const [snapshot, workspace] = await Promise.all([
      read<Omit<PreviewSnapshot, 'theme'>>(`/pages/${target.pageId}/schema`, target.projectId),
      read<WorkspaceRecord>('/workspace'),
    ]);
    return { ...snapshot, theme: workspace.theme };
  });

  ipcMain.handle('preview:exit', async (event): Promise<void> => {
    const entry = [...views.values()].find(({ view }) => view.webContents === event.sender);
    if (!entry || event.senderFrame !== event.sender.mainFrame) throw new Error('预览视图未授权');
    exitPreview(entry);
  });

  ipcMain.handle('window:set-preview-bounds', async (event, input: unknown): Promise<void> => {
    const window = getWorkbenchWindow();
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== event.sender.mainFrame
    ) {
      throw new Error('工作台窗口未授权');
    }
    if (!Value.Check(PreviewBoundsSchema, input)) throw new Error('预览区域参数无效');
    previewBounds = input;
    resizeActiveView();
  });

  ipcMain.handle('window:close-preview', async (event, input: unknown): Promise<void> => {
    const window = getWorkbenchWindow();
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== event.sender.mainFrame
    ) {
      throw new Error('工作台窗口未授权');
    }
    if (!Value.Check(PageWindowSchema, input)) throw new Error('页面窗口参数无效');
    const entry = views.get(keyOf(input));
    if (entry) destroyPreview(entry);
  });

  const showPreview = async (input: PageWindowInput): Promise<void> => {
    const window = getWorkbenchWindow();
    if (!window || window.isDestroyed()) throw new Error('工作台窗口不可用');
    bindWindowLifecycle(window);
    const pages = await read<PageRecord[]>(`/projects/${input.projectId}/pages`);
    const page = pages.find((item) => item.id === input.pageId);
    if (!page) throw new Error('页面不存在');

    const key = keyOf(input);
    let entry = views.get(key);
    if (!entry) {
      const view = new WebContentsView({
        webPreferences: {
          preload: join(__dirname, '../preload/preview.cjs'),
          partition: `origamix-preview-${input.projectId}-${input.pageId}`,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      entry = { view, target: input };
      views.set(key, entry);
      view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      view.webContents.on('will-navigate', (event) => event.preventDefault());
      view.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
        callback(false),
      );
      const previewRoute = `/preview?${new URLSearchParams({ previewTitle: page.name }).toString()}`;
      try {
        const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
        if (rendererUrl) {
          const url = new URL(rendererUrl);
          url.hash = previewRoute;
          await view.webContents.loadURL(url.toString());
        } else {
          await view.webContents.loadFile(getRendererPath(), { hash: previewRoute });
        }
      } catch (error) {
        views.delete(key);
        view.webContents.close();
        throw error;
      }
    }

    if (activeKey && activeKey !== key) {
      const active = views.get(activeKey);
      if (active) window.contentView.removeChildView(active.view);
    }
    activeKey = key;
    window.contentView.addChildView(entry.view);
    resizeActiveView();
    entry.view.webContents.focus();
  };

  ipcMain.handle('window:open-page', async (event, input: unknown) => {
    if (!Value.Check(PageWindowSchema, input)) throw new Error('页面窗口参数无效');
    const window = getWorkbenchWindow();
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== event.sender.mainFrame
    ) {
      throw new Error('工作台窗口未授权');
    }
    const key = keyOf(input);
    const operation = (pending.get(key) ?? Promise.resolve())
      .catch(() => undefined)
      .then(() => showPreview(input));
    pending.set(key, operation);
    try {
      await operation;
    } finally {
      if (pending.get(key) === operation) pending.delete(key);
    }
  });
}
