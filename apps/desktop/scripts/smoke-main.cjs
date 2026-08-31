const { app, BrowserWindow, dialog, utilityProcess } = require('electron');
const { mkdtempSync, mkdirSync, rmSync, existsSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const assert = require('node:assert/strict');

const state = mkdtempSync(join(tmpdir(), 'origamix-main-smoke-'));
const projects = join(state, 'projects');
mkdirSync(projects);
app.setPath('userData', state);
delete process.env.ELECTRON_RENDERER_URL;
delete process.env.ORIGAMIX_TEMPLATE_DIR;
// Only replace the external OS picker. All IPC handlers, windows and persistence are real.
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [projects] });
dialog.showErrorBox = (title, content) => fail(new Error(`${title}: ${content}`));
const fork = utilityProcess.fork.bind(utilityProcess);
let backendExited = false;
utilityProcess.fork = (...args) => {
  const backend = fork(...args);
  backend.once('exit', (code) => { backendExited = code === 0; });
  return backend;
};
let passed = false;
const timer = setTimeout(() => fail(new Error('Real Main smoke timed out')), 30000);
function fail(error) { console.error(error); app.exit(1); }
process.on('exit', () => rmSync(state, { recursive: true, force: true }));
app.on('will-quit', () => {
  clearTimeout(timer);
  if (!passed || !backendExited) return fail(new Error('Application quit without passing checks or closing its backend'));
  console.info('Real Main smoke passed: workspace, directory IPC, project creation, preview, theme and graceful backend shutdown.');
});

async function waitFor(check) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Window did not reach the expected state');
}

require(resolve(__dirname, '../dist/main/index.cjs'));
app.whenReady().then(async () => {
  const main = await waitFor(() => BrowserWindow.getAllWindows()[0]);
  await waitFor(() => !main.webContents.isLoading() && main.webContents.executeJavaScript(
    `Boolean(document.querySelector('main') && !document.querySelector('[aria-label="恢复工作区"]'))`));
  const result = await main.webContents.executeJavaScript(`(async () => {
    const connection = await window.api.backend.getConnection();
    const request = async (path, body, method = 'POST') => {
      const response = await fetch(connection.baseUrl + path, {
        method: body ? method : 'GET',
        headers: { Authorization: 'Bearer ' + connection.token, 'X-Origamix-Service': connection.serviceInstanceId,
          ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    };
    const grant = await window.api.dialog.chooseProjectParent();
    const project = await request('/projects', { directoryGrantId: grant.directoryGrantId, name: 'Smoke Project', code: 'smoke-project' });
    const pages = await request('/projects/' + project.id + '/pages');
    await request('/workspace', { activeProjectId: project.id, activePageId: pages[0].id, theme: 'dark' }, 'PATCH');
    await window.api.window.openPage({ projectId: project.id, pageId: pages[0].id, mode: 'preview' });
    return { path: project.path, pageId: pages[0].id };
  })()`);
  assert.equal(result.path, join(projects, 'smoke-project'));
  assert.ok(existsSync(join(result.path, 'origamix.project.json')));
  assert.ok(!existsSync(join(result.path, 'node_modules')));
  const preview = await waitFor(() => BrowserWindow.getAllWindows().find((window) => window !== main));
  await waitFor(() => !preview.webContents.isLoading() && preview.webContents.executeJavaScript(
    `document.documentElement.dataset.theme === 'dark' && document.body.innerText.includes('已同步')`));
  const snapshot = await preview.webContents.executeJavaScript('window.preview.readSnapshot()');
  assert.equal(snapshot.theme, 'dark');
  assert.equal(await preview.webContents.executeJavaScript('typeof window.api'), 'undefined');
  preview.close();
  await waitFor(() => preview.isDestroyed());
  main.reload();
  await waitFor(() => !main.webContents.isLoading() && main.webContents.executeJavaScript(
    `document.documentElement.dataset.theme === 'dark' && document.body.innerText.includes('Smoke Project')`));
  passed = true;
  app.quit();
}).catch(fail);
