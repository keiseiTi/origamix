import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'vite';

process.env.ORIGAMIX_ENV_LOCAL = '0';
process.env.ORIGAMIX_SERVER_PORT = '0';

const directory = await mkdtemp(join(tmpdir(), 'origamix-web-smoke-'));
const root = fileURLToPath(new URL('../', import.meta.url));
process.env.ORIGAMIX_WEB_STATE_DIR = directory;
const project = join(directory, 'project');
process.env.ORIGAMIX_WEB_PROJECT_DIR = project;
delete process.env.DEEPSEEK_API_KEY;
delete process.env.ORIGAMIX_DESKTOP;
let server;
try {
  await mkdir(project);
  for (const name of ['origamix.project.json', 'package.json', 'src'])
    await cp(join(root, '../template', name), join(project, name), { recursive: true });
  server = await createServer({
    root,
    configFile: `${root}vite.config.ts`,
    server: { host: '127.0.0.1', port: 5188, strictPort: true },
  });
  await server.listen();
  const url = 'http://127.0.0.1:5188/api/v1/health';
  const sameOrigin = { 'Sec-Fetch-Site': 'same-origin' };
  const initial = await fetch(url, { headers: sameOrigin });
  assert.equal(initial.status, 200);
  assert.equal((await initial.json()).success, true);
  const untrustedHeaders: Record<string, string>[] = [
    { ...sameOrigin, Origin: 'https://example.com' },
    { ...sameOrigin, Origin: 'null' },
    { 'Sec-Fetch-Site': 'cross-site' },
    { 'Sec-Fetch-Site': 'same-site' },
    {},
  ];
  for (const headers of untrustedHeaders) {
    const response = await fetch(url, { headers });
    assert.equal(response.status, 403);
  }
  const result = await promisify(execFile)(
    'pnpm',
    ['--filter', '@origamix/desktop', 'test:main', '--web', new URL(url).origin],
    { cwd: join(root, '../..'), timeout: 45000 },
  );
  process.stdout.write(result.stdout);
  console.info(
    'Web test passed: authenticated API proxy, untrusted origins and preview isolation.',
  );
} finally {
  await server?.close();
  await rm(directory, { recursive: true, force: true });
}
