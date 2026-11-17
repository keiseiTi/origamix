/* eslint-disable @typescript-eslint/no-require-imports -- Electron loads this CommonJS entry through tsx/cjs. */
delete process.env.NODE_OPTIONS;
const { app, BrowserWindow } = require('electron') as typeof import('electron');
const { mkdtempSync, rmSync } = require('node:fs') as typeof import('node:fs');
const { join } = require('node:path') as typeof import('node:path');
const { tmpdir } = require('node:os') as typeof import('node:os');
const { seedPreviewPage, verifyPreview } =
  require('./preview-isolation.cts') as typeof import('./preview-isolation.cts');

const state = mkdtempSync(join(tmpdir(), 'origamix-web-preview-'));
app.setPath('userData', state);
process.on('exit', () => rmSync(state, { recursive: true, force: true }));
const url = new URL(process.argv[2]);
if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1')
  throw new Error('Expected the local Web integration server');

app
  .whenReady()
  .then(async () => {
    const window = new BrowserWindow({ show: false });
    window.webContents.on('console-message', (event) => {
      if (event.level === 'error') console.error(event.message);
    });
    await window.loadURL(url.origin);
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
    await window.loadURL(url.origin);
    await verifyPreview(window.webContents);
    app.exit(0);
  })
  .catch((error: unknown) => {
    console.error(error);
    app.exit(1);
  });
