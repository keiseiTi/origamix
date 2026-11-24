import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'vite';
import { strFromU8, unzipSync } from 'fflate';
import { startProductionWeb } from '../production-web.ts';

process.env.ORIGAMIX_ENV_LOCAL = '0';
const mysqlUrl = process.env.ORIGAMIX_TEST_MYSQL_URL;
if (!mysqlUrl) throw new Error('Set ORIGAMIX_TEST_MYSQL_URL to a disposable MySQL database');
process.env.ORIGAMIX_WEB_MYSQL_URL = mysqlUrl;

const directory = await mkdtemp(join(tmpdir(), 'origamix-web-smoke-'));
const root = fileURLToPath(new URL('../', import.meta.url));
process.env.ORIGAMIX_WEB_STATE_DIR = directory;
delete process.env.DEEPSEEK_API_KEY;
process.env.ORIGAMIX_HOST = 'web';
let server;
let production: Awaited<ReturnType<typeof startProductionWeb>> | undefined;
try {
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
  const { version } = JSON.parse(await readFile(join(root, '../template/package.json'), 'utf8'));
  const templateUrl = new URL(`/api/v1/templates/${version}/download`, url);
  const template = await fetch(templateUrl, { headers: sameOrigin });
  assert.equal(template.status, 200);
  assert.equal(template.headers.get('content-type'), 'application/zip');
  assert.equal(
    template.headers.get('content-disposition'),
    `attachment; filename="origamix-template-${version}.zip"`,
  );
  const archive = Buffer.from(await template.arrayBuffer());
  assert.equal(
    template.headers.get('x-template-sha256'),
    createHash('sha256').update(archive).digest('hex'),
  );
  const files = unzipSync(archive);
  assert.ok(files['origamix.project.json']);
  assert.ok(files['index.html']);
  assert.ok(files['.gitignore']);
  const manifest = JSON.parse(strFromU8(files['package.json']));
  assert.equal(manifest.version, version);
  assert.equal(manifest.dependencies['@origamix/runtime'], version);
  assert.equal(manifest.dependencies['@origamix/materials'], version);
  const missing = await fetch(new URL('/api/v1/templates/0.0.0-missing/download', url), {
    headers: sameOrigin,
  });
  assert.equal(missing.status, 404);
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
    assert.equal((await fetch(templateUrl, { headers })).status, 403);
  }
  const projectInput = {
    name: 'Web smoke',
    code: `web-smoke-${randomUUID()}`,
    pageDirectory: 'pages',
  };
  const created = await fetch(new URL('/api/v1/projects/create', url), {
    method: 'POST',
    headers: { ...sameOrigin, Origin: new URL(url).origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(projectInput),
  });
  assert.equal(created.status, 201, await created.clone().text());
  const { data: devProject } = await created.json();
  const result = await promisify(execFile)(
    'pnpm',
    ['--filter', '@origamix/desktop', 'test:main', '--web', new URL(url).origin],
    { cwd: join(root, '../..'), timeout: 45000 },
  );
  process.stdout.write(result.stdout);
  console.info(
    'Web test passed: authenticated API proxy, template download, untrusted origins and preview isolation.',
  );
  const deleted = await fetch(new URL('/api/v1/projects/delete', url), {
    method: 'POST',
    headers: { ...sameOrigin, Origin: new URL(url).origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: devProject.id }),
  });
  assert.equal(deleted.status, 200);
  await server.close();
  server = undefined;
  const origin = new URL('http://127.0.0.1:5189');
  const password = 'origamix-web-test-password';
  production = await startProductionWeb({
    origin,
    password,
    host: '127.0.0.1',
    port: 5189,
    stateDirectory: join(directory, 'production'),
    rendererDirectory: join(root, 'dist/web'),
    templateDirectory: join(root, '../../dist/web-template'),
    mysqlUrl,
  });
  const health = new URL('/api/v1/health', origin);
  const productionTemplate = new URL(templateUrl.pathname, origin);
  assert.equal((await fetch(health)).status, 401);
  assert.equal((await fetch(productionTemplate)).status, 401);
  const login = new URL('/auth/login', origin);
  const body = new URLSearchParams({ password });
  assert.equal((await fetch(login, { method: 'POST', body })).status, 403);
  const authenticated = await fetch(login, {
    method: 'POST',
    body,
    headers: { Origin: origin.origin },
    redirect: 'manual',
  });
  assert.equal(authenticated.status, 303);
  const issued = authenticated.headers.get('set-cookie');
  assert.ok(issued);
  assert.match(issued, /HttpOnly; SameSite=Strict/);
  const cookie = issued.split(';')[0];
  const headers = { cookie, ...sameOrigin };
  assert.equal((await fetch(health, { headers })).status, 200);
  assert.equal((await fetch(productionTemplate, { headers })).status, 200);
  assert.equal((await fetch(health, { headers: { ...headers, Origin: 'null' } })).status, 403);
  assert.equal(
    (await fetch(new URL('/api/v1/projects/invalid/agent/runs/invalid/events', origin))).status,
    401,
  );
  const productionRequest = async (path: string, data = {}) => {
    const response = await fetch(new URL(`/api/v1${path}`, origin), {
      method: 'POST',
      headers: { ...headers, Origin: origin.origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    assert.ok(response.ok && result.success, JSON.stringify(result));
    return result.data;
  };
  const registered = await productionRequest('/projects/create', projectInput);
  const page = await productionRequest('/pages/create', {
    projectId: registered.id,
    name: 'Agent transport',
    slug: 'agent-transport',
  });
  const { workingVersion } = await productionRequest('/pages/working-state/get', {
    projectId: registered.id,
    pageId: page.id,
  });
  const { runId } = await productionRequest('/agent/runs/create', {
    version: '1',
    projectId: registered.id,
    pageId: page.id,
    clientRequestId: 'request_web_agent_sse',
    baseWorkingVersion: workingVersion,
    content: { version: '1', blocks: [{ type: 'text', text: 'Add a button' }] },
  });
  const stream = await fetch(
    new URL(`/api/v1/projects/${registered.id}/agent/runs/${runId}/events`, origin),
    {
      headers: { ...headers, Accept: 'text/event-stream' },
      signal: AbortSignal.timeout(8000),
    },
  );
  assert.equal(stream.status, 200);
  assert.match(stream.headers.get('content-type') ?? '', /text\/event-stream/);
  assert.equal(stream.headers.get('x-accel-buffering'), 'no');
  assert.match(await stream.text(), /event: run\.failed/);
  const browser = await promisify(execFile)(
    'pnpm',
    ['--filter', '@origamix/desktop', 'test:main', '--web', origin.origin, password],
    { cwd: join(root, '../..'), timeout: 45000 },
  );
  process.stdout.write(browser.stdout);
  await productionRequest('/projects/delete', {
    projectId: registered.id,
  });
  const logout = await fetch(new URL('/auth/logout', origin), {
    method: 'POST',
    headers: { ...headers, Origin: origin.origin },
  });
  assert.equal(logout.status, 204);
  assert.equal((await fetch(health, { headers })).status, 401);
  console.info('Production Web test passed: session boundary, template, workbench and preview.');
} finally {
  await production?.close();
  await server?.close();
  await rm(directory, { recursive: true, force: true });
}
