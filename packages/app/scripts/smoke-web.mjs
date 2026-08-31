import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const directory = await mkdtemp(join(tmpdir(), 'origamix-web-smoke-'));
const root = fileURLToPath(new URL('../', import.meta.url));
process.env.ORIGAMIX_WEB_STATE_DIR = directory;
delete process.env.ORIGAMIX_WEB_PROJECT_DIR;
delete process.env.ORIGAMIX_DESKTOP;
let server;
try {
  server = await createServer({ root, configFile: `${root}vite.config.ts`,
    server: { host: '127.0.0.1', port: 5188, strictPort: true } });
  await server.listen();
  const url = 'http://127.0.0.1:5188/api/v1/workspace';
  const initial = await fetch(url);
  assert.equal(initial.status, 200);
  assert.equal((await initial.json()).data.theme, 'light');
  const denied = await fetch(url, { headers: { Origin: 'https://example.com' } });
  assert.equal(denied.status, 403);
  const saved = await fetch(url, { method: 'PATCH', headers: {
    'content-type': 'application/json', Origin: 'http://127.0.0.1:5188'
  }, body: JSON.stringify({ theme: 'dark' }) });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).data.theme, 'dark');
  console.info('Web smoke passed: same-origin API, authenticated writes, rejected untrusted origin.');
} finally {
  await server?.close();
  await rm(directory, { recursive: true, force: true });
}
