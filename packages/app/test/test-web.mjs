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
  server = await createServer({
    root,
    configFile: `${root}vite.config.ts`,
    server: { host: '127.0.0.1', port: 5188, strictPort: true },
  });
  await server.listen();
  const url = 'http://127.0.0.1:5188/api/v1/health';
  const initial = await fetch(url);
  assert.equal(initial.status, 200);
  assert.equal((await initial.json()).success, true);
  const denied = await fetch(url, { headers: { Origin: 'https://example.com' } });
  assert.equal(denied.status, 403);
  console.info('Web test passed: authenticated API proxy and rejected untrusted origin.');
} finally {
  await server?.close();
  await rm(directory, { recursive: true, force: true });
}
