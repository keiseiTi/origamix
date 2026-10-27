import { fork, spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { mkdtemp, rename, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { build } from 'tsup';
import electronPath from 'electron';
import { desktopRoot, workspaceRoot, options } from './build-options.mjs';
import { copyServerArtifact } from './copy-server-artifact.mjs';
import { stopChild } from '@origamix/server/development';

const require = createRequire(import.meta.url);
const tsupManifest = require('tsup/package.json');
const tsupCli = join(dirname(require.resolve('tsup/package.json')), tsupManifest.bin.tsup);
const dirty = new Set(['shared', 'runtime', 'materials', 'server', 'desktop', 'template']);
const watchers = [];
let electron;
let vite;
let builder;
let running = false;
let stopping = false;
let timer;
let generation = 0;
let started = false;
let paused = false;

const run = async (entry, cwd) => {
  const child = fork(entry, [], { cwd, stdio: 'inherit' });
  builder = child;
  const [code] = await once(child, 'exit');
  if (builder === child) builder = undefined;
  if (code !== 0 || stopping) throw new Error(`构建未完成：${cwd}`);
};
const stopDesktop = async () => {
  const previous = electron;
  if (!previous || previous.exitCode !== null || previous.signalCode !== null) return;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      previous.off('exit', exited);
      reject(new Error('桌面退出超时，已暂停更新，请检查后重试'));
    }, 15000);
    const exited = () => {
      clearTimeout(timeout);
      resolve();
    };
    previous.once('exit', exited);
    previous.kill('SIGTERM');
  });
};
const start = async (env, rendererUrl) => {
  let occupied = false;
  try {
    await fetch(rendererUrl, { signal: AbortSignal.timeout(500) });
    occupied = true;
  } catch {
    /* port is available */
  }
  if (occupied) throw new Error('页面开发端口已被占用，请先关闭已有开发服务或调整端口');
  const nextVite = fork(`${workspaceRoot}packages/app/scripts/dev.mjs`, ['--force'], {
    cwd: `${workspaceRoot}packages/app`,
    stdio: 'inherit',
    env: {
      ...process.env,
      ORIGAMIX_DESKTOP: '1',
      ORIGAMIX_RENDERER_HOST: env.ORIGAMIX_RENDERER_HOST,
      ORIGAMIX_RENDERER_PORT: env.ORIGAMIX_RENDERER_PORT,
    },
  });
  vite = nextVite;
  nextVite.once('exit', () => {
    if (!stopping && vite === nextVite) console.error('页面开发服务已停止，请重新启动 pnpm dev');
  });
  const deadline = Date.now() + 30000;
  let available = false;
  while (!stopping && Date.now() < deadline) {
    if (nextVite.exitCode !== null) throw new Error('页面开发服务启动失败');
    try {
      if ((await fetch(rendererUrl, { signal: AbortSignal.timeout(1000) })).ok) {
        available = true;
        break;
      }
    } catch {
      /* starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  if (!available) throw new Error('页面开发服务启动超时');
  const config = await import('../src/main/config.ts');
  const debug = config.desktopDebug(env)
    ? [
        `--inspect=${config.desktopPort(env, 'ORIGAMIX_INSPECT_PORT')}`,
        `--remote-debugging-port=${config.desktopPort(env, 'ORIGAMIX_DEBUG_PORT')}`,
      ]
    : [];
  const launchEnv = { ...env, ELECTRON_RENDERER_URL: rendererUrl };
  delete launchEnv.ELECTRON_RUN_AS_NODE;
  const child = spawn(electronPath, [...debug, desktopRoot], {
    cwd: workspaceRoot,
    stdio: 'inherit',
    env: launchEnv,
  });
  electron = child;
  child.once('exit', () => {
    if (electron === child) {
      electron = undefined;
    }
  });
};
const update = async () => {
  if (running || stopping || !dirty.size) return;
  running = true;
  let completed = false;
  let stagedTemplate;
  const initial = !started;
  const batch = new Set(dirty);
  for (const name of batch) dirty.delete(name);
  try {
    const config = await import(`../src/main/config.ts?generation=${++generation}`);
    const env = config.loadDesktopEnvironment(desktopRoot);
    const rendererUrl = config.desktopRendererUrl(env);
    config.desktopDebug(env);
    if (batch.has('shared')) {
      batch.add('runtime');
      batch.add('materials');
      batch.add('server');
      batch.add('desktop');
      batch.add('template');
    }
    if (batch.has('runtime')) {
      batch.add('materials');
      batch.add('template');
    }
    if (batch.has('materials')) {
      batch.add('server');
      batch.add('template');
    }
    for (const name of ['shared', 'runtime', 'materials'])
      if (batch.has(name)) await run(tsupCli, `${workspaceRoot}packages/${name}`);
    if (batch.has('server')) await run(require.resolve('@origamix/server/build'), workspaceRoot);
    if (batch.has('desktop')) await build({ ...options, clean: false });
    if (stopping) return;
    const { assembleResources } = await import('./assemble-resources.mjs');
    stagedTemplate = await mkdtemp(`${desktopRoot}dist/.template-next-`);
    await assembleResources({ templatePath: stagedTemplate });
    if (stopping) return;
    if (!initial && (paused || dirty.size)) {
      for (const name of batch) dirty.add(name);
      if (paused) console.info('[开发环境] 自动重启已暂停，输入 p 并回车恢复。');
      else completed = true;
      return;
    }
    await stopDesktop();
    const previousVite = vite;
    vite = undefined;
    await stopChild(previousVite);
    await rm(`${desktopRoot}dist/template`, { recursive: true, force: true });
    await rename(stagedTemplate, `${desktopRoot}dist/template`);
    stagedTemplate = undefined;
    await copyServerArtifact();
    await start(env, rendererUrl);
    started = true;
    console.info(initial ? '[开发环境] 桌面已启动' : '[开发环境] 桌面已自动重启');
    completed = true;
  } catch (error) {
    for (const name of batch) dirty.add(name);
    console.error('[开发环境] 更新暂停：', error.message, '。处理后按 Enter 重试。');
  } finally {
    if (stagedTemplate) await rm(stagedTemplate, { recursive: true, force: true });
    running = false;
    if (completed && dirty.size) schedule();
  }
};
const schedule = () => {
  clearTimeout(timer);
  timer = setTimeout(() => void update(), 400);
};
for (const [name, paths] of Object.entries({
  shared: [
    'packages/shared/src',
    'packages/shared/package.json',
    'packages/shared/tsup.config.ts',
    'packages/shared/tsconfig.json',
    'tsconfig.base.json',
  ],
  runtime: [
    'packages/runtime/src',
    'packages/runtime/package.json',
    'packages/runtime/tsup.config.ts',
    'packages/runtime/tsconfig.json',
  ],
  materials: [
    'packages/materials/src',
    'packages/materials/antd',
    'packages/materials/package.json',
    'packages/materials/tsup.config.ts',
    'packages/materials/tsconfig.json',
  ],
  server: [
    'packages/server/src',
    'packages/server/package.json',
    'packages/server/scripts/build-options.mjs',
    'packages/server/tsconfig.json',
  ],
  desktop: [
    'apps/desktop/src',
    'apps/desktop/.env',
    'apps/desktop/.env.local',
    'apps/desktop/tsconfig.json',
  ],
  template: [
    'packages/template/src',
    'packages/template/package.json',
    'packages/template/origamix.project.json',
    'packages/template/vite.config.ts',
    'packages/template/README.md',
    'packages/template/index.html',
    'packages/template/.gitignore',
    'packages/template/tsconfig.json',
    'packages/template/tsconfig.app.json',
    'packages/template/tsconfig.node.json',
    'packages/template/eslint.config.js',
  ],
})) {
  for (const path of paths) {
    try {
      watchers.push(
        watch(join(workspaceRoot, path), { recursive: true }, () => {
          dirty.add(name);
          schedule();
        }),
      );
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}
watchers.push(
  watch(desktopRoot, (_event, filename) => {
    if (filename === '.env.local' || filename === '.env') {
      dirty.add('desktop');
      schedule();
    }
  }),
);
const terminal = createInterface({ input: process.stdin });
terminal.on('line', (line) => {
  if (line.trim().toLowerCase() === 'p') {
    paused = !paused;
    console.info(paused ? '[开发环境] 自动重启已暂停' : '[开发环境] 自动重启已恢复');
  }
  if (!paused && dirty.size) schedule();
});
console.info('[开发环境] 输入 p 并回车可暂停／恢复自动重启；构建失败后按 Enter 重试。');
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  clearTimeout(timer);
  watchers.forEach((watcher) => watcher.close());
  terminal.close();
  await Promise.all([stopChild(builder), stopChild(vite), stopChild(electron)]);
};
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
await update();
