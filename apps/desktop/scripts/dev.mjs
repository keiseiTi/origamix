import {
  loadDesktopEnvironment,
  desktopRendererUrl,
  desktopDebug,
  desktopPort,
} from '../src/main/config.ts';
import { build } from 'tsup';
import electronPath from 'electron';
import { fork, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { desktopRoot, workspaceRoot, options } from './build-options.mjs';
import { assembleResources } from './assemble-resources.mjs';
import { copyServerArtifact } from './copy-server-artifact.mjs';
import { stopChild } from '@origamix/server/development';

const envConfig = loadDesktopEnvironment(desktopRoot);
const rendererUrl = desktopRendererUrl(envConfig);
const debugArgs = desktopDebug(envConfig)
  ? [
      `--inspect=${desktopPort(envConfig, 'ORIGAMIX_INSPECT_PORT')}`,
      `--remote-debugging-port=${desktopPort(envConfig, 'ORIGAMIX_DEBUG_PORT')}`,
    ]
  : [];
const abort = new AbortController();
let electron;
let stopping = false;
let desktopReady = false;
let restartQueue = Promise.resolve();
const require = createRequire(import.meta.url);
const serverWatcher = fork(require.resolve('@origamix/server/build'), ['--watch'], {
  cwd: workspaceRoot,
  stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
});
const serverReady = new Promise((resolve, reject) => {
  serverWatcher.once('message', resolve);
  serverWatcher.once('error', reject);
  serverWatcher.once('exit', () => reject(new Error('Server compiler exited before startup')));
});
const vite = fork(`${workspaceRoot}packages/app/scripts/dev.mjs`, [], {
  cwd: `${workspaceRoot}packages/app`,
  stdio: 'inherit',
  env: {
    ...process.env,
    ORIGAMIX_DESKTOP: '1',
    ORIGAMIX_RENDERER_HOST: envConfig.ORIGAMIX_RENDERER_HOST,
    ORIGAMIX_RENDERER_PORT: envConfig.ORIGAMIX_RENDERER_PORT,
  },
});

async function stopElectron() {
  const child = electron;
  electron = undefined;
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill();
  const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
  try {
    await exited;
  } finally {
    clearTimeout(timer);
  }
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
vite.once('error', (error) => {
  console.error(error);
  void shutdown(1);
});
vite.once('exit', (code) => {
  if (!stopping) void shutdown(code ?? 1);
});
serverWatcher.once('exit', (code) => {
  if (!stopping) void shutdown(code ?? 1);
});

function restartElectron() {
  restartQueue = restartQueue
    .then(async () => {
      if (stopping || !desktopReady) return;
      await stopElectron();
      await copyServerArtifact();
      if (stopping || !desktopReady) return;
      const env = {
        ...envConfig,
        ELECTRON_RENDERER_URL: rendererUrl,
        ORIGAMIX_TEMPLATE_DIR: envConfig.ORIGAMIX_TEMPLATE_DIR,
      };
      delete env.ELECTRON_RUN_AS_NODE;
      electron = spawn(electronPath, [...debugArgs, desktopRoot], {
        cwd: workspaceRoot,
        stdio: 'inherit',
        env,
      });
      electron.once('error', (error) => {
        console.error(error);
        void shutdown(1);
      });
    })
    .catch(async (error) => {
      console.error(error);
      await shutdown(1);
    });
  return restartQueue;
}
serverWatcher.on('message', () => {
  // if (desktopReady) void restartElectron();
});

async function waitForRenderer() {
  const deadline = Date.now() + 30000;
  while (!stopping && Date.now() < deadline) {
    try {
      const response = await fetch(rendererUrl, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      /* Vite may still be starting. */
    }
    await delay(150, undefined, { signal: abort.signal });
  }
  throw new Error('Renderer did not become ready within 30 seconds');
}

try {
  await Promise.all([waitForRenderer(), serverReady]);
  await assembleResources();
  await build({
    ...options,
    clean: false,
    watch: [`${desktopRoot}src`, `${workspaceRoot}packages/shared/src`],
    // tsup calls this after all desktop entries succeed and runs the returned
    // cleanup before rebuilding, preventing stale or partially built launches.
    async onSuccess() {
      if (stopping) return;
      desktopReady = true;
      await restartElectron();
      return async () => {
        desktopReady = false;
        await restartQueue;
        await stopElectron();
      };
    },
  });
} catch (error) {
  if (!stopping) console.error(error);
  await shutdown(1);
}
