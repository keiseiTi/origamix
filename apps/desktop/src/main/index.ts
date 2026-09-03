import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  screen,
  dialog,
  safeStorage,
  utilityProcess,
  type UtilityProcess,
} from 'electron';
import { join } from 'path';
import { writeFile, readFile } from 'fs/promises';
import { nanoid } from 'nanoid';
import { registerPageWindows } from './page-windows';
import type { BackendConnection } from '@origamix/shared/desktop-api';

const isDevelopment = !app.isPackaged;
const rendererIndexPath = (): string =>
  isDevelopment
    ? join(__dirname, '../../../../packages/app/dist/index.html')
    : join(process.resourcesPath, 'app', 'index.html');

let workbenchWindow: BrowserWindow | undefined;

function createWindow(): BrowserWindow {
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
    title: 'origamix',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: false,
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
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (isDevelopment && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(rendererIndexPath());
  }
  return mainWindow;
}

let backendProcess: UtilityProcess | undefined;
let backendConnection: BackendConnection | undefined;

async function startBackend(): Promise<BackendConnection> {
  const serviceInstanceId = nanoid();
  const token = nanoid(48);
  const backend = utilityProcess.fork(join(__dirname, 'server.cjs'), [], { stdio: 'pipe' });

  backendProcess = backend;
  return new Promise<BackendConnection>((resolve, reject) => {
    let settled = false;
    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    };
    const timeout = setTimeout(() => fail(new Error('本地服务启动超时')), 10_000);
    backend.on('message', (message: { kind?: string; port?: number; message?: string }) => {
      if (message.kind === 'error') {
        fail(new Error(message.message ?? '本地服务启动失败'));
        return;
      }
      if (message.kind !== 'ready' || !message.port) return;
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      backendConnection = {
        baseUrl: `http://127.0.0.1:${message.port}/api/v1`,
        token,
        serviceInstanceId,
      };
      console.info('[Origamix Server] 已就绪');
      resolve(backendConnection);
    });
    backend.once('exit', (code) => {
      if (backendProcess === backend) backendProcess = undefined;
      backendConnection = undefined;
      fail(new Error(`本地服务异常退出（退出码 ${code}）`));
    });
    backend.stdout?.on('data', (data) => {
      process.stdout.write(`[Server Log]: ${data.toString()}`);
    });
    backend.stderr?.on('data', (chunk: Buffer) => {
      console.error(`[Origamix Server] ${chunk.toString().trim()}`);
    });
    backend.once('spawn', () => {
      backend.postMessage({
        kind: 'initialize',
        databasePath: join(app.getPath('userData'), 'origamix.db'),
        templatePath: app.isPackaged
          ? join(process.resourcesPath, 'template')
          : (process.env.ORIGAMIX_TEMPLATE_DIR ?? join(__dirname, '../template')),
        desktopToken: token,
        serviceInstanceId,
      });
    });
  });
}

function grantDirectory(path: string): { directoryGrantId: string; displayPath: string } {
  if (!backendProcess) throw new Error('本地服务尚未就绪');
  const directoryGrantId = `grant_${nanoid()}`;
  backendProcess.postMessage({ kind: 'grant', grantId: directoryGrantId, path });
  return { directoryGrantId, displayPath: path };
}

interface StoredModelSettings {
  provider: 'deepseek';
  model: 'deepseek-v4-flash';
  encryptedApiKey?: string;
}

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

function modelSettingsPath(): string {
  return join(app.getPath('userData'), 'model-settings.json');
}

function userProfileSettingsPath(): string {
  return join(app.getPath('userData'), 'user-profile.json');
}

async function readUserProfile(): Promise<UserProfileSettings> {
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
}

async function saveUserProfile(input: {
  name: string;
  iconBackground: string;
}): Promise<UserProfileSettings> {
  const name = input.name?.trim();
  if (!name || name.length > 40) throw new Error('用户名称应为 1–40 个字符');
  if (!allowedIconBackgrounds.has(input.iconBackground)) throw new Error('不支持该头像背景色');
  const profile = { name, iconBackground: input.iconBackground };
  await writeFile(userProfileSettingsPath(), `${JSON.stringify(profile, null, 2)}\n`, {
    mode: 0o600,
  });
  return profile;
}

async function readModelSettings(): Promise<StoredModelSettings> {
  try {
    const value = JSON.parse(await readFile(modelSettingsPath(), 'utf8')) as StoredModelSettings;
    return {
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      encryptedApiKey: value.encryptedApiKey,
    };
  } catch {
    return { provider: 'deepseek', model: 'deepseek-v4-flash' };
  }
}

async function saveModelSettings(input: {
  provider: string;
  model: string;
  apiKey?: string;
}): Promise<{ hasApiKey: boolean }> {
  if (input.provider !== 'deepseek' || input.model !== 'deepseek-v4-flash') {
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
    `${JSON.stringify({ provider: 'deepseek', model: 'deepseek-v4-flash', encryptedApiKey }, null, 2)}\n`,
    { mode: 0o600 },
  );
  return { hasApiKey: Boolean(encryptedApiKey) };
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app
  .whenReady()
  .then(async () => {
    // Set app user model id for windows
    app.setAppUserModelId('com.origamix');

    await startBackend();
    registerPageWindows(
      () => {
        if (!backendConnection) throw new Error('本地服务不可用');
        return backendConnection;
      },
      rendererIndexPath,
      () => workbenchWindow,
    );

    ipcMain.handle('backend:get-connection', () => {
      if (!backendConnection) throw new Error('本地服务不可用');
      return backendConnection;
    });
    ipcMain.handle('dialog:choose-project-parent', async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
      });
      return result.canceled || !result.filePaths[0] ? null : grantDirectory(result.filePaths[0]);
    });
    ipcMain.handle('dialog:choose-existing-project', async () => {
      const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
      return result.canceled || !result.filePaths[0] ? null : grantDirectory(result.filePaths[0]);
    });
    ipcMain.handle('settings:model:get', async () => {
      const settings = await readModelSettings();
      return {
        provider: settings.provider,
        model: settings.model,
        hasApiKey: Boolean(settings.encryptedApiKey),
      };
    });
    ipcMain.handle('settings:model:save', (_event, input) => saveModelSettings(input));
    ipcMain.handle('settings:profile:get', () => readUserProfile());
    ipcMain.handle('settings:profile:save', (_event, input) => saveUserProfile(input));

    workbenchWindow = createWindow();

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) workbenchWindow = createWindow();
    });
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : '本地服务启动失败';
    console.error(message);
    dialog.showErrorBox('Origamix 无法启动', message);
    app.quit();
  });

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

let backendStopped = false;
let quitting = false;
app.on('before-quit', (event) => {
  if (backendStopped || !backendProcess) return;
  event.preventDefault();
  if (quitting) return;
  quitting = true;
  const backend = backendProcess;
  const timeout = setTimeout(() => backend.kill(), 3000);
  backend.once('exit', () => {
    clearTimeout(timeout);
    backendStopped = true;
    app.quit();
  });
  backend.postMessage({ kind: 'shutdown' });
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
