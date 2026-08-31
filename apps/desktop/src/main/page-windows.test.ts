import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerPageWindows } from './page-windows';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => Promise<unknown>>(),
  windows: [] as Array<{
    options: { webPreferences: { preload: string; partition: string; sandbox: boolean } };
    webContents: { mainFrame: object };
    loadFile: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }>
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: (name: string, handler: (...args: unknown[]) => Promise<unknown>) =>
      mocks.handlers.set(name, handler)
  },
  BrowserWindow: class {
    webContents = {
      mainFrame: {},
      setWindowOpenHandler: vi.fn(),
      on: vi.fn(),
      session: { setPermissionRequestHandler: vi.fn() }
    };
    loadFile = vi.fn().mockResolvedValue(undefined);
    loadURL = vi.fn().mockResolvedValue(undefined);
    on = vi.fn();
    focus = vi.fn();
    show = vi.fn();
    restore = vi.fn();
    setTitle = vi.fn();
    destroy = vi.fn();
    isDestroyed = (): boolean => false;
    isMinimized = (): boolean => false;
    constructor(public options: (typeof mocks.windows)[number]['options']) {
      mocks.windows.push(this);
    }
  }
}));

const open = (projectId = 'project_one', pageId = 'page_one'): Promise<unknown> =>
  mocks.handlers.get('window:open-page')!({}, { projectId, pageId, mode: 'preview' });

beforeEach(() => {
  mocks.handlers.clear();
  mocks.windows.length = 0;
  vi.stubEnv('ELECTRON_RENDERER_URL', '');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      json: async () => ({
        ok: true,
        data: url.endsWith('/pages')
          ? [
              { id: 'page_one', name: '页面一' },
              { id: 'page_two', name: '页面二' }
            ]
          : url.endsWith('/workspace')
            ? { theme: 'dark' }
            : { schema: { elements: {} }, revisionId: 'revision_one' }
      })
    }))
  );
  registerPageWindows(() => ({
    baseUrl: 'http://localhost/api/v1',
    token: 'desktop-secret',
    serviceInstanceId: 'instance_one'
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('MVP preview windows', () => {
  it('reuses one window per project and retargets only on an explicit preview request', async () => {
    await open();
    await open();
    expect(mocks.windows).toHaveLength(1);
    expect(mocks.windows[0].loadFile).toHaveBeenCalledTimes(1);
    await open('project_one', 'page_two');
    expect(mocks.windows).toHaveLength(1);
    expect(mocks.windows[0].loadFile).toHaveBeenCalledTimes(2);
    expect(mocks.windows[0].loadFile.mock.calls[1][1].query.pageId).toBe('page_two');
    await open('project_two');
    expect(mocks.windows).toHaveLength(2);
  });
  it('serializes concurrent clicks without duplicate windows', async () => {
    await Promise.all([open(), open(), open('project_one', 'page_two')]);
    expect(mocks.windows).toHaveLength(1);
    expect(mocks.windows[0].loadFile).toHaveBeenCalledTimes(2);
  });
  it('rejects editing windows and invalid or missing pages', async () => {
    await expect(
      mocks.handlers.get('window:open-page')!(
        {},
        { projectId: 'project_one', pageId: 'page_one', mode: 'edit' }
      )
    ).rejects.toThrow('参数无效');
    await expect(open('../escape')).rejects.toThrow('参数无效');
    await expect(open('project_one', 'page_missing')).rejects.toThrow('页面不存在');
    expect(mocks.windows).toHaveLength(0);
  });
  it('isolates preview sessions and uses a sandboxed read-only preload', async () => {
    await open();
    await open('project_two');
    const preferences = mocks.windows[0].options.webPreferences;
    expect(preferences.sandbox).toBe(true);
    expect(preferences.preload).toMatch(/preload\/preview.cjs$/);
    expect(preferences.partition).not.toBe(mocks.windows[1].options.webPreferences.partition);
    expect(preferences.partition).not.toMatch(/^persist:/);
  });
  it('scopes snapshot reads to the registered window, not caller-supplied targets', async () => {
    await open();
    const sender = mocks.windows[0].webContents;
    const read = mocks.handlers.get('preview:read-snapshot')!;
    await expect(read({ sender: {}, senderFrame: {} })).rejects.toThrow('未授权');
    await expect(read({ sender, senderFrame: {} })).rejects.toThrow('未授权');
    const snapshot = await read({ sender, senderFrame: sender.mainFrame }, { pageId: 'page_two' });
    expect(snapshot).toEqual({
      schema: { elements: {} },
      revisionId: 'revision_one',
      theme: 'dark'
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost/api/v1/pages/page_one/schema',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-origamix-project-id': 'project_one' })
      })
    );
    expect(JSON.stringify(snapshot)).not.toContain('desktop-secret');
  });
});
