const { app, BrowserWindow, dialog, utilityProcess, webContents } = require('electron');
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
let currentBackend;
utilityProcess.fork = (...args) => {
  const backend = fork(...args);
  currentBackend = backend;
  backend.once('exit', (code) => {
    backendExited = code === 0;
  });
  return backend;
};
let passed = false;
const timer = setTimeout(() => fail(new Error('Real Main smoke timed out')), 30000);
function fail(error) {
  console.error(error);
  app.exit(1);
}
process.on('exit', () => rmSync(state, { recursive: true, force: true }));
app.on('will-quit', () => {
  clearTimeout(timer);
  if (!passed || !backendExited)
    return fail(new Error('Application quit without passing checks or closing its backend'));
  console.info(
    'Main test passed: directory IPC, project creation, preview, theme and graceful backend shutdown.',
  );
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
app
  .whenReady()
  .then(async () => {
    const main = await waitFor(() => BrowserWindow.getAllWindows()[0]);
    await waitFor(
      () =>
        !main.webContents.isLoading() &&
        main.webContents.executeJavaScript(
          `Boolean(document.querySelector('main') && !document.querySelector('[aria-label="恢复工作区"]'))`,
        ),
    );
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
      if (!result.success) throw new Error(result.message || 'Desktop smoke request failed');
      return result.data;
    };
    const grant = await window.api.dialog.chooseProjectParent();
    const project = await request('/projects', { directoryGrantId: grant.directoryGrantId, name: 'Smoke Project', code: 'smoke-project' });
    await request('/projects/' + project.id + '/pages', { name: 'Home', slug: 'home', route: '/' });
    const pages = await request('/projects/' + project.id + '/pages');
    await window.api.window.setPreviewBounds({ x: 256, y: 40, width: innerWidth - 256, height: innerHeight - 40 });
    await window.api.window.openPage({ projectId: project.id, pageId: pages[0].id, mode: 'preview', theme: 'light' });
    return { path: project.path, projectId: project.id, pageId: pages[0].id, serviceInstanceId: connection.serviceInstanceId };
  })()`);
    assert.equal(result.path, join(projects, 'smoke-project'));
    assert.ok(existsSync(join(result.path, 'origamix.project.json')));
    assert.ok(!existsSync(join(result.path, 'node_modules')));
    const interruptedBackend = currentBackend;
    interruptedBackend.kill();
    await waitFor(() => currentBackend !== interruptedBackend && currentBackend);
    const recoveredConnection = await main.webContents.executeJavaScript(
      'window.api.backend.getConnection()',
    );
    assert.notEqual(recoveredConnection.serviceInstanceId, result.serviceInstanceId);
    const recoveredProjects = await main.webContents.executeJavaScript(`(async () => {
      const connection = await window.api.backend.getConnection();
      const response = await fetch(connection.baseUrl + '/projects', { headers: {
        Authorization: 'Bearer ' + connection.token,
        'X-Origamix-Service': connection.serviceInstanceId
      }});
      return response.json();
    })()`);
    assert.equal(recoveredProjects.success, true);
    assert.equal(
      recoveredProjects.data.some((project) => project.id),
      true,
    );
    const preview = await waitFor(() =>
      webContents
        .getAllWebContents()
        .find((contents) => contents !== main.webContents && contents.getType() === 'window'),
    );
    await waitFor(
      () =>
        !preview.isLoading() &&
        preview.executeJavaScript(
          `document.documentElement.dataset.theme === 'light' && Boolean(document.querySelector('[aria-label="退出预览"]'))`,
        ),
    );
    const snapshot = await preview.executeJavaScript('window.preview.readSnapshot()');
    assert.equal(snapshot.theme, 'light');
    assert.equal(await preview.executeJavaScript('typeof window.api'), 'undefined');
    await main.webContents.executeJavaScript(`(async () => {
      localStorage.setItem('origamix:theme', 'dark');
      await window.api.window.openPage({
        projectId: ${JSON.stringify(result.projectId)},
        pageId: ${JSON.stringify(result.pageId)},
        mode: 'preview',
        theme: 'dark'
      });
    })()`);
    await waitFor(() =>
      preview.executeJavaScript(`document.documentElement.dataset.theme === 'dark'`),
    );
    await preview.executeJavaScript('window.preview.exit()');
    main.reload();
    await waitFor(
      () =>
        !main.webContents.isLoading() &&
        main.webContents.executeJavaScript(
          `document.documentElement.dataset.theme === 'dark' && document.body.innerText.includes('Smoke Project')`,
        ),
    );
    passed = true;
    app.quit();
  })
  .catch(fail);
