import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerPageWindows } from './page-windows';

type Handler = (...args: unknown[]) => Promise<unknown>;
interface MockView {
  options: {
    webPreferences: {
      preload: string;
      partition: string;
      sandbox: boolean;
      nodeIntegration: boolean;
      contextIsolation: boolean;
    };
  };
  webContents: {
    mainFrame: object;
    loadFile: ReturnType<typeof vi.fn>;
    loadURL: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
  setBounds: ReturnType<typeof vi.fn>;
}

const mocks = vi.hoisted(() => {
  const workbenchContents = { mainFrame: {}, send: vi.fn() };
  return {
    handlers: new Map<string, Handler>(),
    windowEvents: new Map<string, () => void>(),
    views: [] as MockView[],
    workbench: {
      webContents: workbenchContents,
      contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
      getContentSize: vi.fn(() => [1200, 800]),
      on: vi.fn((name: string, listener: () => void) => mocks.windowEvents.set(name, listener)),
      isDestroyed: (): boolean => false,
    },
  };
});

vi.mock('electron', () => ({
  ipcMain: {
    handle: (name: string, handler: Handler) => mocks.handlers.set(name, handler),
  },
  BrowserWindow: class {},
  WebContentsView: class {
    webContents = {
      mainFrame: {},
      setWindowOpenHandler: vi.fn(),
      on: vi.fn(),
      session: { setPermissionRequestHandler: vi.fn() },
      loadFile: vi.fn().mockResolvedValue(undefined),
      loadURL: vi.fn().mockResolvedValue(undefined),
      focus: vi.fn(),
      close: vi.fn(),
    };
    setBounds = vi.fn();
    constructor(public options: MockView['options']) {
      mocks.views.push(this as MockView);
    }
  },
}));

const workbenchEvent = () => ({
  sender: mocks.workbench.webContents,
  senderFrame: mocks.workbench.webContents.mainFrame,
});
const open = async (projectId = 'project_one', pageId = 'page_one'): Promise<unknown> => {
  await mocks.handlers.get('window:set-preview-bounds')!(workbenchEvent(), {
    x: 256,
    y: 40,
    width: 944,
    height: 760,
  });
  return mocks.handlers.get('window:open-page')!(workbenchEvent(), {
    projectId,
    pageId,
    mode: 'preview',
  });
};

beforeEach(() => {
  mocks.handlers.clear();
  mocks.windowEvents.clear();
  mocks.views.length = 0;
  vi.clearAllMocks();
  vi.stubEnv('ELECTRON_RENDERER_URL', '');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      json: async () => ({
        success: true,
        code: 200,
        data: url.endsWith('/pages')
          ? [
              { id: 'page_one', name: '页面一' },
              { id: 'page_two', name: '页面二' },
            ]
          : url.endsWith('/workspace')
            ? { theme: 'dark' }
            : { schema: { elements: {} }, revisionId: 'revision_one' },
      }),
    })),
  );
  registerPageWindows(
    () => ({
      baseUrl: 'http://localhost/api/v1',
      token: 'desktop-secret',
      serviceInstanceId: 'instance_one',
    }),
    () => '/test-renderer/index.html',
    () => mocks.workbench as never,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('page preview WebContentsViews', () => {
  it('creates one view per page and reuses it', async () => {
    await open();
    await open();
    await open('project_one', 'page_two');
    expect(mocks.views).toHaveLength(2);
    expect(mocks.views[0].webContents.loadFile).toHaveBeenCalledTimes(1);
    expect(mocks.views[0].webContents.loadFile).toHaveBeenCalledWith('/test-renderer/index.html', {
      hash: '/preview?previewTitle=%E9%A1%B5%E9%9D%A2%E4%B8%80',
    });
    expect(mocks.workbench.contentView.addChildView).toHaveBeenLastCalledWith(mocks.views[1]);
    expect(mocks.workbench.contentView.removeChildView).toHaveBeenCalledWith(mocks.views[0]);
    expect(mocks.views[1].setBounds).toHaveBeenCalledWith({
      x: 256,
      y: 40,
      width: 944,
      height: 760,
    });
  });

  it('keeps the active preview fitted to the workspace when the window resizes', async () => {
    await open();
    mocks.workbench.getContentSize.mockReturnValueOnce([1000, 700]);
    mocks.windowEvents.get('resize')?.();
    expect(mocks.views[0].setBounds).toHaveBeenLastCalledWith({
      x: 256,
      y: 40,
      width: 744,
      height: 660,
    });
  });

  it('serializes concurrent requests for the same page', async () => {
    await Promise.all([open(), open(), open()]);
    expect(mocks.views).toHaveLength(1);
    expect(mocks.views[0].webContents.loadFile).toHaveBeenCalledTimes(1);
  });

  it('loads the preview route through the development renderer URL', async () => {
    vi.stubEnv('ELECTRON_RENDERER_URL', 'http://127.0.0.1:5173/');
    await open();
    expect(mocks.views[0].webContents.loadURL).toHaveBeenCalledWith(
      'http://127.0.0.1:5173/#/preview?previewTitle=%E9%A1%B5%E9%9D%A2%E4%B8%80',
    );
  });

  it('rejects unauthorized callers and invalid or missing pages', async () => {
    await expect(
      mocks.handlers.get('window:open-page')!(workbenchEvent(), {
        projectId: 'project_one',
        pageId: 'page_one',
        mode: 'edit',
      }),
    ).rejects.toThrow('参数无效');
    await expect(
      mocks.handlers.get('window:open-page')!(
        { sender: {}, senderFrame: {} },
        {
          projectId: 'project_one',
          pageId: 'page_one',
          mode: 'preview',
        },
      ),
    ).rejects.toThrow('未授权');
    await expect(open('project_one', 'page_missing')).rejects.toThrow('页面不存在');
  });

  it('uses isolated sandboxed preview sessions', async () => {
    await open();
    await open('project_one', 'page_two');
    expect(mocks.views[0].options.webPreferences).toMatchObject({
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
    });
    expect(mocks.views[0].options.webPreferences.preload).toMatch(/preload\/preview.cjs$/);
    expect(mocks.views[0].options.webPreferences.partition).not.toBe(
      mocks.views[1].options.webPreferences.partition,
    );
  });

  it('authorizes snapshot reads and exits only from a registered view', async () => {
    await open();
    const sender = mocks.views[0].webContents;
    const event = { sender, senderFrame: sender.mainFrame };
    await expect(
      mocks.handlers.get('preview:read-snapshot')!({ sender: {}, senderFrame: {} }),
    ).rejects.toThrow('未授权');
    const snapshot = await mocks.handlers.get('preview:read-snapshot')!(event);
    expect(snapshot).toEqual({
      schema: { elements: {} },
      revisionId: 'revision_one',
      theme: 'dark',
    });
    await mocks.handlers.get('preview:exit')!(event);
    expect(mocks.workbench.contentView.removeChildView).toHaveBeenCalledWith(mocks.views[0]);
    expect(mocks.workbench.webContents.send).toHaveBeenCalledWith('preview:exited', {
      projectId: 'project_one',
      pageId: 'page_one',
      mode: 'preview',
    });
  });

  it('destroys the page preview when its tab closes', async () => {
    await open();
    await mocks.handlers.get('window:close-preview')!(workbenchEvent(), {
      projectId: 'project_one',
      pageId: 'page_one',
      mode: 'preview',
    });
    expect(mocks.workbench.contentView.removeChildView).toHaveBeenCalledWith(mocks.views[0]);
    expect(mocks.views[0].webContents.close).toHaveBeenCalledOnce();

    await open();
    expect(mocks.views).toHaveLength(2);
  });
});
