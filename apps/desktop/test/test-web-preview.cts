/* eslint-disable @typescript-eslint/no-require-imports -- Electron loads this CommonJS entry through tsx/cjs. */
delete process.env.NODE_OPTIONS;
const { app, BrowserWindow } = require('electron') as typeof import('electron');
const { mkdtempSync, rmSync } = require('node:fs') as typeof import('node:fs');
const { join } = require('node:path') as typeof import('node:path');
const { tmpdir } = require('node:os') as typeof import('node:os');
const { seedPreviewPage, verifyPreview, waitFor } =
  require('./preview-isolation.cts') as typeof import('./preview-isolation.cts');

const state = mkdtempSync(join(tmpdir(), 'origamix-web-preview-'));
app.setPath('userData', state);
process.on('exit', () => rmSync(state, { recursive: true, force: true }));
const url = new URL(process.argv[2]);
const password = process.argv[3];
if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1')
  throw new Error('Expected the local Web integration server');

const login = async (window: InstanceType<typeof BrowserWindow>) => {
  if (new URL(window.webContents.getURL()).pathname !== '/auth/login')
    throw new Error('Production workbench did not require login');
  await window.webContents.executeJavaScript(`(() => {
    document.querySelector('input[name="password"]').value = ${JSON.stringify(password)};
    document.querySelector('form').requestSubmit();
  })()`);
  await waitFor(() => new URL(window.webContents.getURL()).pathname === '/');
};

app
  .whenReady()
  .then(async () => {
    const window = new BrowserWindow({ show: false });
    window.webContents.on('console-message', (event) => {
      if (event.level === 'error') console.error(event.message);
    });
    await window.loadURL(url.origin);
    if (password) await login(window);
    await window.webContents.executeJavaScript(`(async () => {
    const baseUrl = location.origin + '/api/v1';
    const request = async (path, body = {}) => {
      const response = await fetch(baseUrl + path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Web smoke request failed');
      return result.data;
    };
    const [project] = await request('/projects/list');
    await (${seedPreviewPage.toString()})(request, project.id, baseUrl);
  })()`);
    await window.loadURL(password ? new URL('/workspace/direct/', url).href : url.origin);
    await verifyPreview(window.webContents);
    if (password) {
      await window.webContents.session.cookies.remove(url.origin, 'origamix-loopback-session');
      const checkSession = () =>
        window.webContents.executeJavaScript("window.dispatchEvent(new Event('focus')); void 0");
      const loginLink = () =>
        window.webContents.executeJavaScript(
          `Boolean(document.querySelector('[role="status"] a[href="/auth/login"]'))`,
        );
      await checkSession();
      await waitFor(loginLink);

      const reauth = new BrowserWindow({ show: false });
      await reauth.loadURL(new URL('/auth/login', url).href);
      await login(reauth);
      reauth.destroy();
      await checkSession();
      await waitFor(async () => !(await loginLink()));
      if (new URL(window.webContents.getURL()).pathname !== '/workspace/direct/')
        throw new Error('Reauthentication moved the current workbench');
      await window.webContents.executeJavaScript(
        `document.querySelector('[aria-label="退出登录"]').click()`,
      );
      await waitFor(() => new URL(window.webContents.getURL()).pathname === '/auth/login');
    }
    app.exit(0);
  })
  .catch((error: unknown) => {
    console.error(error);
    app.exit(1);
  });
