const { app, BrowserWindow, ipcMain, utilityProcess } = require('electron');
const assert = require('node:assert/strict');
const { existsSync, mkdtempSync, rmSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { randomUUID } = require('node:crypto');

const state = mkdtempSync(join(tmpdir(), 'origamix-electron-smoke-'));
app.setPath('userData', state);
if (!process.argv[2]) throw new Error('Provide the packaged application Resources directory');
const resources = resolve(process.argv[2]);
assert.equal(existsSync(join(resources, 'app.asar', 'node_modules')), false,
  'Bundled application must not ship a second dependency tree');
for (const name of ['runtime.tgz', 'materials.tgz'])
  assert.ok(existsSync(join(resources, 'template', 'vendor', name)), `Missing template dependency: ${name}`);
const desktopDist = join(resources, 'app.asar', 'dist');
const renderer = join(resources, 'app', 'index.html');
const template = join(resources, 'template');
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
