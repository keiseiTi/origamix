const { app, BrowserWindow, ipcMain, utilityProcess } = require('electron');
const { mkdtempSync, rmSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { randomUUID } = require('node:crypto');

const state = mkdtempSync(join(tmpdir(), 'origamix-electron-smoke-'));
app.setPath('userData', state);
const resources = process.argv[2] && resolve(process.argv[2]);
const desktopDist = resources ? join(resources, 'app.asar', 'dist') : resolve(__dirname, '../dist');
const renderer = resources ? join(resources, 'app', 'index.html') : resolve(__dirname, '../../../packages/app/dist/index.html');
const template = resources ? join(resources, 'template') : resolve(__dirname, '../dist/template');
let backend;
let window;
const timer = setTimeout(() => finish(new Error('Electron smoke timed out')), 20000);
let finished = false;
function finish(error) {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  window?.destroy();
  backend?.kill();
  if (error) console.error(error);
  else console.info('Electron smoke passed: file:// renderer, packaged assets, preload IPC and SQLite backend.');
  app.exit(error ? 1 : 0);
}
process.on('exit', () => rmSync(state, { recursive: true, force: true }));

app.whenReady().then(async () => {
  const token = randomUUID();
  const serviceInstanceId = randomUUID();
  backend = utilityProcess.fork(join(desktopDist, 'main', 'server.cjs'), [], { stdio: 'pipe' });
  backend.stderr?.on('data', (data) => process.stderr.write(data));
  backend.once('exit', (code) => { if (!finished) finish(new Error(`Backend exited: ${code}`)); });
  backend.on('message', async (message) => {
    if (message.kind === 'error') return finish(new Error(message.message));
    if (message.kind !== 'ready') return;
    try {
      ipcMain.handle('backend:get-connection', () => ({ baseUrl: `http://127.0.0.1:${message.port}/api/v1`, token, serviceInstanceId }));
      ipcMain.handle('settings:profile:get', () => ({ name: 'Smoke Test', iconBackground: '#2563eb' }));
      window = new BrowserWindow({ show: false, webPreferences: {
        preload: join(desktopDist, 'preload', 'index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true
      } });
      await window.loadFile(renderer);
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        const ready = await window.webContents.executeJavaScript(`Boolean(document.querySelector('main') && !document.querySelector('[aria-label="恢复工作区"]'))`);
        if (ready) return finish();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(await window.webContents.executeJavaScript('document.body.innerText'));
    } catch (error) { finish(error); }
  });
  backend.once('spawn', () => backend.postMessage({ kind: 'initialize', databasePath: ':memory:',
    templatePath: template, desktopToken: token, serviceInstanceId }));
}).catch(finish);
