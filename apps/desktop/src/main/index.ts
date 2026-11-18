import { createBackendLifecycle } from './backend-lifecycle';
import { registerDevelopmentControl } from './development-control';
import { app, shell, BrowserWindow, ipcMain, screen, dialog, safeStorage } from 'electron';
import { join } from 'path';
import { resolveDesktopConfig } from './config';
import { installApplicationMenu } from './menu';
import { pathToFileURL } from 'node:url';
import { assertWorkbenchCaller, isTrustedWorkbenchUrl } from './workbench-security';
import { writeFile, readFile } from 'fs/promises';
import type { BackendStatus, ModelSettings } from '@origamix/shared';

let desktopConfig: ReturnType<typeof resolveDesktopConfig>;
const workbenchEntryUrl = (): string =>
  desktopConfig.rendererUrl ?? pathToFileURL(desktopConfig.rendererPath).href;

let workbenchWindow: BrowserWindow | undefined;

const createWindow = (): BrowserWindow => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: width,
    height: height,
    show: false,
    x: 0,
    y: 0,
    minWidth: 1280,
    minHeight: 768,
    resizable: true,
    title: 'OrigaMix',
    autoHideMenuBar: true,
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 12, y: 12 },
        }
      : {}),
    webPreferences: {
      preload: desktopConfig.preloadPath,
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.on('ready-to-show', () => {
    // mainWindow.webContents.openDevTools();

    mainWindow.show();
  });
  mainWindow.on('closed', () => {
    if (workbenchWindow === mainWindow) workbenchWindow = undefined;
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    const protocol = new URL(details.url).protocol;
    if (protocol === 'https:' || protocol === 'http:') void shell.openExternal(details.url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedWorkbenchUrl(url, workbenchEntryUrl())) event.preventDefault();
  });
  mainWindow.webContents.on('will-redirect', (event, url) => {
    if (!isTrustedWorkbenchUrl(url, workbenchEntryUrl())) event.preventDefault();
  });

  if (desktopConfig.rendererUrl) {
    void mainWindow.loadURL(desktopConfig.rendererUrl);
  } else {
    void mainWindow.loadFile(desktopConfig.rendererPath);
  }
  return mainWindow;
};

const reloadDevelopmentWorkbench = async (): Promise<void> => {
  const window = workbenchWindow;
  for (let attempt = 0; ; attempt += 1) {
    if (!window || window.isDestroyed() || workbenchWindow !== window)
      throw new Error('工作台窗口已关闭');
    try {
      await window.loadURL(workbenchEntryUrl());
      return;
    } catch (error) {
      // Vite may reload the document while its dependency optimizer settles.
      const navigationAborted =
        error instanceof Error &&
        (('code' in error && error.code === 'ERR_ABORTED') ||
          ('errno' in error && error.errno === -3));
      if (!navigationAborted || attempt >= 3) throw error;
      await new Promise<void>((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    }
  }
};

let backend: ReturnType<typeof createBackendLifecycle> | undefined;
const notifyBackendStatus = (status: BackendStatus): void => {
  const contents = workbenchWindow?.webContents;
  if (
    contents &&
    !contents.isDestroyed() &&
    isTrustedWorkbenchUrl(contents.getURL(), workbenchEntryUrl())
  )
    contents.send('backend:status-changed', status);
};

interface StoredModelSettings {
  provider: 'deepseek';
  model: ModelSettings['model'];
  encryptedApiKey?: string;
}

const defaultModel: ModelSettings['model'] = 'deepseek-flash';
const supportedModels = new Set<ModelSettings['model']>(['deepseek-flash', 'deepseek-v4-pro']);

interface UserProfileSettings {
  name: string;
  iconBackground: string;
}

const allowedIconBackgrounds = new Set([
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#dc2626',
  '#d97706',
  '#059669',
  '#475569',
]);

const modelSettingsPath = (): string => {
  return join(app.getPath('userData'), 'model-settings.json');
};

const userProfileSettingsPath = (): string => {
  return join(app.getPath('userData'), 'user-profile.json');
};

const readUserProfile = async (): Promise<UserProfileSettings> => {
  try {
    const value = JSON.parse(
      await readFile(userProfileSettingsPath(), 'utf8'),
    ) as UserProfileSettings;
    return {
      name: value.name?.trim().slice(0, 40) || 'Origamix 用户',
      iconBackground: allowedIconBackgrounds.has(value.iconBackground)
        ? value.iconBackground
        : '#2563eb',
    };
  } catch {
    return { name: 'Origamix 用户', iconBackground: '#2563eb' };
  }
};

const saveUserProfile = async (input: {
  name: string;
  iconBackground: string;
}): Promise<UserProfileSettings> => {
  const name = input.name?.trim();
  if (!name || name.length > 40) throw new Error('用户名称应为 1–40 个字符');
  if (!allowedIconBackgrounds.has(input.iconBackground)) throw new Error('不支持该头像背景色');
  const profile = { name, iconBackground: input.iconBackground };
  await writeFile(userProfileSettingsPath(), `${JSON.stringify(profile, null, 2)}\n`, {
    mode: 0o600,
  });
  return profile;
};

const readModelSettings = async (): Promise<StoredModelSettings> => {
  try {
    const value = JSON.parse(await readFile(modelSettingsPath(), 'utf8')) as StoredModelSettings;
    return {
      provider: 'deepseek',
      model: supportedModels.has(value.model) ? value.model : defaultModel,
      encryptedApiKey: value.encryptedApiKey,
    };
  } catch {
    return { provider: 'deepseek', model: defaultModel };
  }
};

const readModelApiKey = async (provider?: string): Promise<string | undefined> => {
  if (provider !== 'deepseek' || !safeStorage.isEncryptionAvailable()) return undefined;
  const settings = await readModelSettings();
  if (!settings.encryptedApiKey) return undefined;
  try {
    return safeStorage.decryptString(Buffer.from(settings.encryptedApiKey, 'base64'));
  } catch {
    return undefined;
  }
};

const saveModelSettings = async (input: {
  provider: string;
  model: string;
  apiKey?: string;
}): Promise<{ hasApiKey: boolean }> => {
  if (
    input.provider !== 'deepseek' ||
    !supportedModels.has(input.model as ModelSettings['model'])
  ) {
    throw new Error('暂不支持该模型配置');
  }
  const current = await readModelSettings();
  const apiKey = input.apiKey?.trim();
  if (!current.encryptedApiKey && !apiKey) throw new Error('请输入 DeepSeek API Key');
  if (apiKey && apiKey.length < 8) throw new Error('API Key 格式无效');
  if (apiKey && !safeStorage.isEncryptionAvailable())
    throw new Error('当前系统无法安全保存 API Key');

  const encryptedApiKey = apiKey
    ? safeStorage.encryptString(apiKey).toString('base64')
    : current.encryptedApiKey;
  await writeFile(
    modelSettingsPath(),
    `${JSON.stringify({ provider: 'deepseek', model: input.model, encryptedApiKey }, null, 2)}\n`,
    { mode: 0o600 },
  );
  return { hasApiKey: Boolean(encryptedApiKey) };
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app
  .whenReady()
  .then(async () => {
    // Set app user model id for windows
    app.setAppUserModelId('com.origamix');

    // Keep the existing data directory across the display-name change.
    const userDataPath = app.isPackaged
      ? join(app.getPath('appData'), 'origamix')
      : app.getPath('userData');
    app.setPath('userData', userDataPath);
    app.setName('OrigaMix');
    installApplicationMenu();

    desktopConfig = resolveDesktopConfig({
      packaged: app.isPackaged,
      mainDirectory: __dirname,
      resourcesPath: process.resourcesPath,
      userDataPath: app.getPath('userData'),
    });
    const lifecycle = createBackendLifecycle({
      config: desktopConfig,
      workbenchOrigin: new URL(workbenchEntryUrl()).origin,
      notifyStatus: notifyBackendStatus,
      readModelApiKey,
      readModelReference: async () => {
        const settings = await readModelSettings();
        return `${settings.provider}/${settings.model}`;
      },
    });
    backend = lifecycle;
    await lifecycle.ensureBackend();
    const handleWorkbench = (
      channel: string,
      listener: Parameters<typeof ipcMain.handle>[1],
    ): void => {
      ipcMain.handle(channel, (event, ...args) => {
        assertWorkbenchCaller(event, workbenchWindow?.webContents, workbenchEntryUrl());
        return listener(event, ...args);
      });
    };
    handleWorkbench('backend:get-connection', () => lifecycle.ensureBackend());
    handleWorkbench('dialog:choose-project-parent', async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
      });
      return result.canceled || !result.filePaths[0]
        ? null
        : lifecycle.grantDirectory(result.filePaths[0]);
    });
    handleWorkbench('dialog:choose-existing-project', async () => {
      const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
      return result.canceled || !result.filePaths[0]
        ? null
        : lifecycle.grantDirectory(result.filePaths[0]);
    });
    handleWorkbench('settings:model:get', async () => {
      const settings = await readModelSettings();
      return {
        provider: settings.provider,
        model: settings.model,
        hasApiKey: Boolean(settings.encryptedApiKey),
      };
    });
    handleWorkbench('settings:model:save', (_event, input) => saveModelSettings(input));
    handleWorkbench('settings:profile:get', () => readUserProfile());
    handleWorkbench('settings:profile:save', (_event, input) => saveUserProfile(input));

    workbenchWindow = createWindow();
    if (!app.isPackaged && process.env.ORIGAMIX_DEVELOPMENT_CONTROL === '1') {
      const dispose = registerDevelopmentControl({
        pauseBackend: lifecycle.pauseBackend,
        resumeBackend: lifecycle.resumeBackend,
        reloadWorkbench: reloadDevelopmentWorkbench,
        disconnect: () => app.quit(),
      });
      app.once('will-quit', dispose);
    }

    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (!workbenchWindow || workbenchWindow.isDestroyed()) workbenchWindow = createWindow();
    });
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : '本地服务启动失败';
    console.error(message);
    dialog.showErrorBox('Origamix 无法启动', message);
    app.quit();
  });

// Let the development supervisor use the normal backend shutdown lifecycle.
if (!app.isPackaged) process.on('SIGTERM', () => app.quit());

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

let backendShutdownComplete = false;
app.on('before-quit', (event) => {
  if (!backend || backendShutdownComplete) return;
  event.preventDefault();
  void backend.shutdown().then(() => {
    if (backendShutdownComplete) return;
    backendShutdownComplete = true;
    app.quit();
  });
});
