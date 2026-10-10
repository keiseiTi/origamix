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
    'Main test passed: directory IPC, project creation, iframe preview, theme and graceful backend shutdown.',
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
    try {
      await waitFor(
        () =>
          !main.webContents.isLoading() &&
          main.webContents.executeJavaScript(
            `Boolean(document.querySelector('main') && !document.querySelector('[aria-label="恢复工作区"]'))`,
          ),
      );
    } catch (error) {
      console.error(
        'Workspace startup state:',
        await main.webContents.executeJavaScript('document.body.innerText.slice(0, 300)'),
      );
      throw error;
    }
    const result = await main.webContents.executeJavaScript(`(async () => {
    const connection = await window.api.backend.getConnection();
    const request = async (path, body = {}) => {
      const response = await fetch(connection.baseUrl + path, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + connection.token, 'X-Origamix-Service': connection.serviceInstanceId,
          'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Desktop smoke request failed');
      return result.data;
    };
    const grant = await window.api.dialog.chooseProjectParent();
    const project = await request('/projects/create', { directoryGrantId: grant.directoryGrantId, name: 'Smoke Project', code: 'smoke-project', pageDirectory: 'pages' });
    await request('/pages/create', { projectId: project.id, name: 'Home', slug: 'home' });
    const pages = await request('/pages/list', { projectId: project.id });
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
      const response = await fetch(connection.baseUrl + '/projects/list', { method: 'POST', body: JSON.stringify({}), headers: {
        Authorization: 'Bearer ' + connection.token,
        'X-Origamix-Service': connection.serviceInstanceId,
        'Content-Type': 'application/json'
      }});
      return response.json();
    })()`);
    assert.equal(recoveredProjects.success, true);
    assert.equal(
      recoveredProjects.data.some((project) => project.id),
      true,
    );
    await main.webContents.executeJavaScript(`localStorage.setItem('origamix:theme', 'light')`);
    main.reload();
    await waitFor(
      () =>
        !main.webContents.isLoading() &&
        main.webContents.executeJavaScript(
          `document.body.innerText.includes('Smoke Project') && document.body.innerText.includes('Home')`,
        ),
    );
    await main.webContents.executeJavaScript(`(async () => {
      const page = [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Home');
      page?.click();
    })()`);
    await waitFor(() =>
      main.webContents.executeJavaScript(
        `Boolean(document.querySelector('button[aria-label="预览"]'))`,
      ),
    );
    await main.webContents.executeJavaScript(
      `document.querySelector('button[aria-label="预览"]')?.click()`,
    );
    await waitFor(() =>
      main.webContents.executeJavaScript(`(() => {
        const frame = document.querySelector('iframe[title="Home 预览"]');
        return Boolean(frame?.contentDocument?.querySelector('[aria-label="退出预览"]'));
      })()`),
    );
    assert.equal(
      await main.webContents.executeJavaScript(`(() => {
        const frame = document.querySelector('iframe[title="Home 预览"]');
        return frame?.contentDocument?.documentElement.dataset.theme;
      })()`),
      'light',
    );
    assert.equal(
      await main.webContents.executeJavaScript(`(() => {
        const frame = document.querySelector('iframe[title="Home 预览"]');
        return typeof frame?.contentWindow?.api;
      })()`),
      'undefined',
    );
    await main.webContents.executeJavaScript(`(() => {
      const frame = document.querySelector('iframe[title="Home 预览"]');
      frame?.contentDocument?.querySelector('[aria-label="退出预览"]')?.click();
    })()`);
    await waitFor(() =>
      main.webContents.executeJavaScript(
        `document.querySelector('iframe[title="Home 预览"]')?.parentElement?.classList.contains('hidden') === true`,
      ),
    );
    await main.webContents.executeJavaScript(`localStorage.setItem('origamix:theme', 'dark')`);
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
