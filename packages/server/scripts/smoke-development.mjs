import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stopChild } from './development.mjs';

// Test real compilers in a throwaway workspace, without touching source mtimes or user data.
const original = fileURLToPath(new URL('../../../', import.meta.url));
const root = await mkdtemp(join(tmpdir(), 'origamix-dev-smoke-'));
let child;
let output = '';
async function waitFor(check) {
  const deadline = Date.now() + 30000;
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
}
function start(entry, cwd, args = []) {
  output = '';
  child = fork(entry, args, {
    cwd,
    env: {
      ...process.env,
      ORIGAMIX_DESKTOP: '0',
      ORIGAMIX_SERVER_TOKEN: 'development-smoke-token',
      ORIGAMIX_WEB_PROJECT_DIR: '',
      ORIGAMIX_WEB_STATE_DIR: join(root, 'state'),
    },
    silent: true,
  });
  child.stdout.on('data', (data) => {
    output += data;
  });
  child.stderr.on('data', (data) => {
    output += data;
  });
}
try {
  await symlink(join(original, 'node_modules'), join(root, 'node_modules'), 'junction');
  for (const name of ['tsconfig.base.json', 'package.json', 'pnpm-workspace.yaml'])
    await cp(join(original, name), join(root, name));
  await mkdir(join(root, 'packages'));
  for (const name of ['server', 'app', 'shared', 'materials']) {
    const source = join(original, 'packages', name);
    await cp(source, join(root, 'packages', name), {
      recursive: true,
      verbatimSymlinks: true,
      filter: (path) =>
        !relative(source, path)
          .split(sep)
          .some((part) => ['dist', '.vite', '.origamix-web'].includes(part)),
    });
  }
  const serverRoot = join(root, 'packages/server');
  const appRoot = join(root, 'packages/app');
  // App starts without any server dist files. An authenticated proxy must become ready.
  start(join(appRoot, 'scripts/dev.mjs'), appRoot, [
    '--host',
    '127.0.0.1',
    '--port',
    '5189',
    '--strictPort',
  ]);
  const api = 'http://127.0.0.1:5189/api/v1/health';
  const first = await waitFor(async () => (await (await fetch(api)).json()).data.serviceInstanceId);
  const runtime = join(serverRoot, 'runtime.ts');
  await writeFile(
    runtime,
    `${await readFile(runtime, 'utf8')}\nconsole.info('dev-smoke-recompiled');\n`,
  );
  await waitFor(async () => {
    const next = (await (await fetch(api)).json()).data.serviceInstanceId;
    return next !== first && output.includes('dev-smoke-recompiled');
  });
  await stopChild(child);
  child = undefined;
  await assert.rejects(fetch(api));
  // Standalone Server uses the same watch/restart lifecycle.
  start(join(serverRoot, 'scripts/dev.mjs'), serverRoot);
  const url = await waitFor(
    () => output.match(/Local API: (http:\/\/127\.0\.0\.1:\d+\/api\/v1)/)?.[1],
  );
  await writeFile(
    runtime,
    `${await readFile(runtime, 'utf8')}\nconsole.info('standalone-recompiled');\n`,
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
  await stopChild(child);
  await rm(root, { recursive: true, force: true });
}
