import { build } from 'tsup';
import electronPath from 'electron';
import { fork, spawn } from 'node:child_process';
import { cp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { desktopRoot, workspaceRoot, options } from './tsup-options.mjs';
import { stopChild } from '@origamix/server/development';

const rendererUrl = 'http://127.0.0.1:5173';
const abort = new AbortController();
let electron;
let stopping = false;
let desktopReady = false;
let restartQueue = Promise.resolve();
const require = createRequire(import.meta.url);
const serverWatcher = fork(require.resolve('@origamix/server/build'), ['--watch'], {
  cwd: workspaceRoot, stdio: ['inherit', 'inherit', 'inherit', 'ipc']
});
const serverReady = new Promise((resolve, reject) => {
  serverWatcher.once('message', resolve);
  serverWatcher.once('error', reject);
  serverWatcher.once('exit', () => reject(new Error('Server compiler exited before startup')));
});
const vite = fork(`${workspaceRoot}packages/app/scripts/dev.mjs`,
  ['--host', '127.0.0.1'],
  { cwd: `${workspaceRoot}packages/app`, stdio: 'inherit', env: { ...process.env, ORIGAMIX_DESKTOP: '1' } });

async function stopElectron() {
  const child = electron;
  electron = undefined;
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill();
  const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
  try { await exited; } finally { clearTimeout(timer); }
}

async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  abort.abort();
  await Promise.all([stopChild(vite), stopChild(serverWatcher), stopElectron()]);
  process.exit(code);
}

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
vite.once('error', (error) => { console.error(error); void shutdown(1); });
vite.once('exit', (code) => { if (!stopping) void shutdown(code ?? 1); });
serverWatcher.once('exit', (code) => { if (!stopping) void shutdown(code ?? 1); });

function restartElectron() {
  restartQueue = restartQueue.then(async () => {
    if (stopping || !desktopReady) return;
    await stopElectron();
    await cp(require.resolve('@origamix/server/utility'), `${desktopRoot}dist/main/server.cjs`);
    await cp(`${require.resolve('@origamix/server/utility')}.map`, `${desktopRoot}dist/main/server.cjs.map`);
    if (stopping || !desktopReady) return;
    const env = { ...process.env, ELECTRON_RENDERER_URL: rendererUrl,
      ORIGAMIX_TEMPLATE_DIR: `${workspaceRoot}packages/template` };
    delete env.ELECTRON_RUN_AS_NODE;
    const debugArgs = process.env.ORIGAMIX_DEBUG ? ['--inspect=9229', '--remote-debugging-port=9222'] : [];
    electron = spawn(electronPath, [...debugArgs, desktopRoot], { cwd: workspaceRoot, stdio: 'inherit', env });
    electron.once('error', (error) => { console.error(error); void shutdown(1); });
  }).catch(async (error) => { console.error(error); await shutdown(1); });
  return restartQueue;
}
serverWatcher.on('message', () => { if (desktopReady) void restartElectron(); });

async function waitForRenderer() {
  const deadline = Date.now() + 30000;
  while (!stopping && Date.now() < deadline) {
    try {
      const response = await fetch(rendererUrl, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch { /* Vite may still be starting. */ }
    await delay(150, undefined, { signal: abort.signal });
  }
  throw new Error('Renderer did not become ready within 30 seconds');
}

try {
  await Promise.all([waitForRenderer(), serverReady]);
  await build({
    ...options,
    clean: false,
    watch: [
      `${desktopRoot}src`,
      `${workspaceRoot}packages/shared/src`
    ],
    // tsup calls this after all desktop entries succeed and runs the returned
    // cleanup before rebuilding, preventing stale or partially built launches.
    async onSuccess() {
      if (stopping) return;
      desktopReady = true;
      await restartElectron();
      return async () => { desktopReady = false; await restartQueue; await stopElectron(); };
    }
  });
} catch (error) {
  if (!stopping) console.error(error);
  await shutdown(1);
}
