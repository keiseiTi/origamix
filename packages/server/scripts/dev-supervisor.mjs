import { fork } from 'node:child_process';
import { watch } from 'node:fs';
import { once } from 'node:events';
import { join } from 'node:path';
import { libraryNames, libraryWatchPaths, buildLibraries } from './development-libraries.mjs';
import { fileURLToPath } from 'node:url';

export async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

// Rebuild complete dependency batches before replacing the running host.
export const runDevelopment = ({ entry, args = [], watchServer = true }) => {
  let worker, builder, timer;
  let stopping = false,
    running = false;
  const dirty = new Set(watchServer ? libraryNames : []);
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const watchers = [];
  const run = async (script, cwd) => {
    const child = fork(script, [], { cwd, stdio: 'inherit' });
    builder = child;
    const [code] = await once(child, 'exit');
    builder = undefined;
    if (code !== 0 || stopping) throw new Error(`Build failed: ${script}`);
  };
  const update = async () => {
    if (running || stopping) return;
    running = true;
    const batch = new Set(dirty);
    dirty.clear();
    let completed = false;
    try {
      if (watchServer) {
        await buildLibraries(batch, root, run);
        await run(fileURLToPath(new URL('./build.mjs', import.meta.url)), root);
      }
      if (stopping) return;
      if (!dirty.size) {
        const previous = worker;
        worker = undefined;
        await stopChild(previous);
        if (stopping) return;
        worker = fork(entry, args, { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] });
        worker.once('error', (error) => {
          console.error(error);
          void shutdown(1);
        });
        const next = worker;
        next.once('exit', (code) => {
          if (!stopping && worker === next) void shutdown(code ?? 1);
        });
      }
      completed = true;
    } catch (error) {
      for (const name of batch) dirty.add(name);
      console.error('Development build failed; save a watched source to retry:', error);
    } finally {
      running = false;
      if (completed && dirty.size && !stopping) schedule();
    }
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void update(), 400);
  };
  const shutdown = async (code = 0) => {
    if (stopping) return;
    stopping = true;
    clearTimeout(timer);
    watchers.forEach((watcher) => watcher.close());
    await Promise.all([stopChild(builder), stopChild(worker)]);
    process.exitCode = code;
  };
  if (watchServer)
    for (const [name, paths] of Object.entries({
      ...libraryWatchPaths,
      server: ['packages/server/src'],
    }))
      for (const path of paths)
        watchers.push(
          watch(join(root, path), { recursive: true }, () => {
            dirty.add(name);
            schedule();
          }),
        );
  for (const directory of ['apps/desktop', 'packages/server']) {
    try {
      watchers.push(
        watch(join(root, directory), (_event, filename) => {
          if (['package.json', 'tsconfig.json'].includes(filename))
            console.info('[开发环境] 宿主配置已变化，请重新运行开发命令。');
        }),
      );
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  // Tooling modules are cached by Node; changing them requires restarting the launcher.
  for (const directory of ['packages/server/scripts', 'apps/desktop/scripts']) {
    try {
      watchers.push(
        watch(join(root, directory), () =>
          console.info('[开发环境] 启动工具已变化，请重新运行开发命令。'),
        ),
      );
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
  void update();
};
