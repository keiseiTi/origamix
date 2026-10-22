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
    const working = await request('/pages/working-state/get', { projectId: project.id, pageId: pages[0].id });
    await request('/pages/working-operations/apply', { projectId: project.id, pageId: pages[0].id, baseWorkingVersion: working.workingVersion, operations: [{
      operation: 'addElement', elementId: 'preview_button', parentId: 'element_root',
      element: { type: 'button', props: { text: 'Desktop preview verified' } }
    }] });
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
        return Boolean(frame?.contentDocument?.body.innerText.includes('Desktop preview verified'));
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
      document.querySelector('button[aria-label="退出预览"]')?.click();
    })()`);
    await waitFor(() =>
      main.webContents.executeJavaScript(
        `Boolean(document.querySelector('iframe[title="Home 预览"]')?.closest('.hidden'))`,
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
    // New opaque canvas boundary: packaged file resources must load without a bridge.
    await main.webContents.executeJavaScript(`location.hash = '/canvas-prototype'`);
    await waitFor(() =>
      main.webContents.executeJavaScript(`document.body.innerText.includes('已连接 · 局部版本 0')`),
    );
    const canvas = main.webContents.mainFrame.frames.find((frame) => frame.url === 'about:srcdoc');
    assert.ok(canvas, 'Isolated canvas frame must exist');
    const boundary = await canvas.executeJavaScript(`(() => {
      let parentReadable = false;
      try { parentReadable = Boolean(parent.document); } catch {}
      return { bridge: typeof globalThis.api, origin: globalThis.origin, parentReadable,
        rendered: document.body.innerText.includes('选中这个按钮') };
    })()`);
    assert.deepEqual(boundary, {
      bridge: 'undefined',
      origin: 'null',
      parentReadable: false,
      rendered: true,
    });
    assert.equal(
      await main.webContents.executeJavaScript(
        `document.querySelector('iframe[title="隔离画布原型"]').getAttribute('sandbox')`,
      ),
      'allow-scripts',
    );
    console.info(
      'Canvas prototype passed: file resources, opaque origin, rendered materials, no parent DOM or desktop bridge.',
    );
    // A renderer-driven same-window navigation must not replace the trusted document.
    const trustedUrl = main.webContents.getURL();
    const blockedNavigation = new Promise((resolve) => {
      main.webContents.once('will-navigate', (event) => resolve(event.defaultPrevented));
    });
    await main.webContents.executeJavaScript(`location.href = 'https://untrusted.example/'`);
    assert.equal(await blockedNavigation, true);
    assert.equal(main.webContents.getURL(), trustedUrl);
    // Even another window loading our document/preload must not receive backend authority.
    const foreign = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: resolve(__dirname, '../dist/preload/index.cjs'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    try {
      await foreign.loadURL('data:text/html,<title>Untrusted caller</title>');
      const denied = await foreign.webContents.executeJavaScript(`
        window.api.backend.getConnection().then(() => false, () => true)
      `);
      assert.equal(denied, true);
    } finally {
      foreign.destroy();
    }
    passed = true;
    app.quit();
  })
  .catch(fail);
