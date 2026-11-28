import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stopChild } from '../../../scripts/lib/child-process.ts';

process.env.ORIGAMIX_ENV_LOCAL = '0';
const mysqlUrl = process.env.ORIGAMIX_TEST_MYSQL_URL;
if (!mysqlUrl) throw new Error('Set ORIGAMIX_TEST_MYSQL_URL to a disposable MySQL database');

// Test real compilers in a throwaway workspace, without touching source mtimes or user data.
const original = fileURLToPath(new URL('../../../', import.meta.url));
const root = await mkdtemp(join(tmpdir(), 'origamix-dev-smoke-'));
let child: import('node:child_process').ChildProcess | undefined;
let output = '';
const waitFor = async <T>(check: () => T | Promise<T>) => {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) throw new Error(output);
    try {
      const result = await check();
      if (result) return result;
    } catch {
      /* Wait for listener/rebuild. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Development smoke timed out:\n${output}`);
};
const start = (entry: string, cwd: string, args: string[] = [], port = '0') => {
  output = '';
  child = fork(entry, args, {
    cwd,
    env: {
      ...process.env,
      ORIGAMIX_HOST: 'web',
      ORIGAMIX_RENDERER_PORT: '5189',
      ORIGAMIX_WEB_MYSQL_URL: mysqlUrl,
      ORIGAMIX_SERVER_PORT: port,
      ORIGAMIX_SERVER_TOKEN: 'development-smoke-token',
      ORIGAMIX_LOCAL_PROJECT_DIR: '',
      ORIGAMIX_LOCAL_STATE_DIR: join(root, 'state'),
    },
    silent: true,
  });
  child.stdout!.on('data', (data) => {
    output += data;
  });
  child.stderr!.on('data', (data) => {
    output += data;
  });
};
try {
  await symlink(join(original, 'node_modules'), join(root, 'node_modules'), 'junction');
  for (const name of ['tsconfig.base.json', 'package.json', 'pnpm-workspace.yaml'])
    await cp(join(original, name), join(root, name));
  await mkdir(join(root, 'packages'));
  for (const name of [
    'server',
    'app',
    'shared',
    'materials',
    'runtime',
    'template',
    'ui',
    'editor',
  ]) {
    const source = join(original, 'packages', name);
    await cp(source, join(root, 'packages', name), {
      recursive: true,
      verbatimSymlinks: true,
      filter: (path) =>
        !relative(source, path)
          .split(sep)
          .some(
            (part) =>
              ['.vite', '.origamix-local', '.origamix-web', '.env.local'].includes(part) ||
              (part === 'dist' && ['server', 'app'].includes(name)),
          ),
    });
  }
  const serverRoot = join(root, 'packages/server');
  const appRoot = join(root, 'packages/app');
  await writeFile(join(appRoot, '.env.local'), 'ORIGAMIX_RENDERER_PORT=invalid');
  await writeFile(join(serverRoot, '.env.local'), 'ORIGAMIX_LOCAL_STATE_DIR=');
  await mkdir(join(root, 'scripts'));
  for (const file of ['web.ts', 'run-pnpm.ts'])
    await cp(join(original, 'scripts', file), join(root, 'scripts', file));
  await cp(join(original, 'scripts/lib'), join(root, 'scripts/lib'), { recursive: true });
  // The root launcher starts the backend before Vite and keeps Vite across backend rebuilds.
  start(join(root, 'scripts/web.ts'), root, [], '5190');
  const api = 'http://127.0.0.1:5189/api/v1/health';
  const fetchWebHealth = () => fetch(api, { headers: { 'Sec-Fetch-Site': 'same-origin' } });
  await waitFor(async () => (await fetchWebHealth()).ok);

  const schemaService = join(serverRoot, 'src/schema/schema-service.ts');
  await writeFile(
    schemaService,
    `${await readFile(schemaService, 'utf8')}\nconsole.info('dev-smoke-recompiled');\n`,
  );
  const launches = () => (output.match(/Web API:/g) ?? []).length;
  await waitFor(
    async () =>
      launches() >= 2 && output.includes('dev-smoke-recompiled') && (await fetchWebHealth()).ok,
  );
  const sharedSource = join(root, 'packages/shared/src/version.ts');
  await writeFile(
    sharedSource,
    `${await readFile(sharedSource, 'utf8')}\n// dependency rebuild smoke\n`,
  );
  await waitFor(async () => launches() >= 3 && (await fetchWebHealth()).ok);
  const rendererReady = output.indexOf('Local:');
  assert.ok(rendererReady > output.indexOf('Web API:'));
  assert.equal((output.match(/Local:/g) ?? []).length, 1);
  await stopChild(child, 10_000);
  child = undefined;
  await assert.rejects(fetchWebHealth());
  await assert.rejects(fetch('http://127.0.0.1:5190/api/v1/health'));
  // Standalone Server uses the same watch/restart lifecycle.
  start(join(serverRoot, 'scripts/dev.ts'), serverRoot);
  const url = await waitFor(
    () => output.match(/Local API: (http:\/\/127\.0\.0\.1:\d+\/api\/v1)/)?.[1],
  );
  const toolRegistry = join(serverRoot, 'src/agent/tools/registry.ts');
  await writeFile(
    toolRegistry,
    `${await readFile(toolRegistry, 'utf8')}\nconsole.info('standalone-recompiled');\n`,
  );
  await waitFor(
    () =>
      output.includes('standalone-recompiled') && (output.match(/Local API:/g)?.length ?? 0) >= 2,
  );
  const urls = [...output.matchAll(/Local API: (http:\/\/127\.0\.0\.1:\d+\/api\/v1)/g)].map(
    (match) => match[1],
  );
  await stopChild(child);
  child = undefined;
  for (const endpoint of new Set([url, ...urls])) await assert.rejects(fetch(`${endpoint}/health`));
  console.info(
    'Development smoke passed: clean App startup, Web/Server rebuild and restart, listener cleanup.',
  );
} finally {
  await stopChild(child, 10_000);
  await rm(root, { recursive: true, force: true });
}
