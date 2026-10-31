import { createDesktopControl } from './desktop-control.ts';
import { rm as cleanOutput } from 'node:fs/promises';
import { fork, spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { mkdtemp, rename, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { build as buildEntries, type InlineConfig } from 'tsdown';

const build = async (config: InlineConfig) => {
  if (config.clean && config.outDir)
    await cleanOutput(config.outDir, { recursive: true, force: true });
  const pending = new Set(Object.keys(config.entry as Record<string, string>));
  const onSuccess = config.onSuccess;
  for (const [name, entry] of Object.entries(config.entry as Record<string, string>)) {
    await buildEntries({
      ...config,
      entry: { [name]: entry },
      clean: false,
      onSuccess:
        typeof onSuccess === 'function'
          ? async (options, signal) => {
              pending.delete(name);
              if (!pending.size) await onSuccess(options, signal);
            }
          : onSuccess,
    });
  }
};
import electronPath from 'electron';
import { desktopRoot, workspaceRoot, options } from './build-options.ts';
import { copyServerArtifact } from './copy-server-artifact.ts';
import { stopChild } from '@origamix/server/development';

const require = createRequire(import.meta.url);
import { libraryWatchPaths, buildLibraries } from '@origamix/server/development-libraries';
const dirty = new Set(['shared', 'runtime', 'materials', 'server', 'desktop', 'template']);
const watchers: import('node:fs').FSWatcher[] = [];
let electron: import('node:child_process').ChildProcess | undefined;
let desktopControl: ReturnType<typeof createDesktopControl> | undefined;
let vite: import('node:child_process').ChildProcess | undefined;
let builder: import('node:child_process').ChildProcess | undefined;
let manifestWatcher: import('node:child_process').ChildProcess | undefined;
let running = false;
let stopping = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;
let started = false;
let paused = false;

const run = async (entry: string, cwd: string, args: string[] = []) => {
  const child = fork(entry, args, { cwd, stdio: 'inherit' });
  builder = child;
  const [code] = await once(child, 'exit');
  if (builder === child) builder = undefined;
  if (code !== 0 || stopping) throw new Error(`构建未完成：${cwd}`);
};
const startManifestWatch = () => {
  if (manifestWatcher || stopping) return;
  const child = fork(
    `${workspaceRoot}packages/materials/scripts/generate-manifest.ts`,
    ['--watch'],
    {
      cwd: `${workspaceRoot}packages/materials`,
      stdio: 'inherit',
    },
  );
  manifestWatcher = child;
  child.once('error', (error) => {
    console.error('[开发环境] Manifest watch 启动失败：', error.message);
  });
  child.once('exit', () => {
    if (manifestWatcher === child) manifestWatcher = undefined;
    if (!stopping) {
      dirty.add('materials');
      console.error('[开发环境] Manifest watch 已停止，按 Enter 重试。');
    }
  });
  console.info('[开发环境] 已启动 Materials manifest:watch');
};
const stopDesktop = async () => {
  const previous = electron;
  if (!previous || previous.exitCode !== null || previous.signalCode !== null) return;
  await new Promise<void>((resolve, reject) => {
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
const startVite = async (env: NodeJS.ProcessEnv, rendererUrl: string) => {
  let occupied = false;
  try {
    await fetch(rendererUrl, { signal: AbortSignal.timeout(500) });
    occupied = true;
  } catch {
    /* port is available */
  }
  if (occupied) throw new Error('页面开发端口已被占用，请先关闭已有开发服务或调整端口');
  const nextVite = fork(`${workspaceRoot}packages/app/scripts/dev.ts`, ['--force'], {
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
};
const start = async (env: NodeJS.ProcessEnv, rendererUrl: string) => {
  await startVite(env, rendererUrl);
  const config = await import('../src/main/config.ts');
  const debug = config.desktopDebug(env)
    ? [
        `--inspect=${config.desktopPort(env, 'ORIGAMIX_INSPECT_PORT')}`,
        `--remote-debugging-port=${config.desktopPort(env, 'ORIGAMIX_DEBUG_PORT')}`,
      ]
    : [];
  const launchEnv: NodeJS.ProcessEnv = {
    ...env,
    ELECTRON_RENDERER_URL: rendererUrl,
    ORIGAMIX_DEVELOPMENT_CONTROL: '1',
  };
  delete launchEnv.ELECTRON_RUN_AS_NODE;
  const child = spawn(electronPath as unknown as string, [...debug, desktopRoot], {
    cwd: workspaceRoot,
    stdio: ['pipe', 'pipe', 'inherit'],
    env: launchEnv,
  });
  child.stdout?.on('data', (data) => process.stdout.write(data));
  electron = child;
  desktopControl = createDesktopControl(child);
  child.once('exit', () => {
    if (electron === child) {
      electron = undefined;
    }
  });
  await desktopControl.ready;
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
    if (batch.has('shared')) batch.add('desktop');
    await buildLibraries(batch, workspaceRoot, run);
    startManifestWatch();
    if (batch.has('server')) await run(require.resolve('@origamix/server/build'), workspaceRoot);
    if (batch.has('desktop')) await build({ ...options, clean: false });
    if (stopping) return;
    const materialsUpdate =
      !initial &&
      batch.has('materials') &&
      [...batch].every((name) => name === 'materials' || name === 'server') &&
      Boolean(electron && desktopControl);
    const backendOnly =
      !initial && batch.size === 1 && batch.has('server') && Boolean(electron && desktopControl);
    if (backendOnly || materialsUpdate) {
      if (paused || dirty.size) {
        for (const name of batch) dirty.add(name);
        if (paused) console.info('[开发环境] 自动重启已暂停，输入 p 并回车恢复。');
        else completed = true;
        return;
      }
      if (materialsUpdate) {
        stagedTemplate = await mkdtemp(`${desktopRoot}dist/.template-next-`);
        await run(`${desktopRoot}scripts/assemble-resources.ts`, workspaceRoot, [stagedTemplate]);
        if (stopping) return;
        if (paused || dirty.size) {
          for (const name of batch) dirty.add(name);
          completed = !paused;
          return;
        }
      }
      await desktopControl!.request('pause-backend');
      await copyServerArtifact();
      if (materialsUpdate) {
        await rm(`${desktopRoot}dist/template`, { recursive: true, force: true });
        await rename(stagedTemplate!, `${desktopRoot}dist/template`);
        stagedTemplate = undefined;
        const previousVite = vite;
        vite = undefined;
        await stopChild(previousVite);
        await startVite(env, rendererUrl);
      }
      await desktopControl!.request('resume-backend');
      if (materialsUpdate) {
        await desktopControl!.request('reload-workbench');
        console.info('[开发环境] 物料已更新，App 已刷新，桌面窗口保持不变');
      }
      console.info('[开发环境] 后端已独立重启，桌面窗口保持不变');
      completed = true;
      return;
    }
    stagedTemplate = await mkdtemp(`${desktopRoot}dist/.template-next-`);
    await run(`${desktopRoot}scripts/assemble-resources.ts`, workspaceRoot, [stagedTemplate]);
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
    console.error('[开发环境] 更新暂停：', (error as Error).message, '。处理后按 Enter 重试。');
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
  ...libraryWatchPaths,
  server: [
    'packages/server/src',
    'packages/server/package.json',
    'packages/server/scripts/build-options.ts',
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
    'packages/template/eslint.config.mjs',
  ],
})) {
  for (const path of paths) {
    try {
      watchers.push(
        watch(join(workspaceRoot, path), { recursive: true }, (_event, filename) => {
          if (
            path === 'packages/materials/antd' &&
            filename?.toString().replaceAll('\\', '/').split('/')[0] === 'generated'
          )
            return;
          dirty.add(name);
          if (
            name === 'server' &&
            filename?.toString().replaceAll('\\', '/').startsWith('templates/')
          )
            dirty.add('template');
          schedule();
        }),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
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
for (const directory of ['apps/desktop', 'packages/server']) {
  try {
    watchers.push(
      watch(join(workspaceRoot, directory), (_event, filename) => {
        if (['package.json', 'tsconfig.json'].includes(filename ?? ''))
          console.info('[开发环境] 宿主配置已变化，请重新运行开发命令。');
      }),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
// Tooling modules are cached by Node; changing them requires restarting the launcher.
for (const directory of ['packages/server/scripts', 'apps/desktop/scripts']) {
  try {
    watchers.push(
      watch(join(workspaceRoot, directory), () =>
        console.info('[开发环境] 启动工具已变化，请重新运行开发命令。'),
      ),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
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
  await Promise.all([
    stopChild(builder),
    stopChild(vite),
    stopChild(electron),
    stopChild(manifestWatcher),
  ]);
};
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
await update();
