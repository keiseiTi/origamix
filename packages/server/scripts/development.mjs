import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.kill('SIGTERM');
  });
}

// Run Node entrypoints directly: no shell/pnpm grandchildren to orphan on exit.
export function runDevelopment({ entry, args = [], watchServer = true }) {
  let worker;
  let compiler;
  let stopping = false;
  let queue = Promise.resolve();
  const shutdown = async (code = 0) => {
    if (stopping) return;
    stopping = true;
    await Promise.all([stopChild(compiler), stopChild(worker)]);
    await queue;
    process.exitCode = code;
  };
  const fail = (error) => { console.error(error); void shutdown(1); };
  const restart = () => {
    queue = queue.then(async () => {
      const old = worker;
      worker = undefined;
      await stopChild(old);
      if (stopping) return;
      const next = fork(entry, args, { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] });
      worker = next;
      next.once('error', fail);
      next.once('exit', (code) => {
        if (!stopping && worker === next) void shutdown(code ?? 1);
      });
    }).catch(fail);
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
  if (watchServer) {
    compiler = fork(fileURLToPath(new URL('./build.mjs', import.meta.url)), ['--watch'], {
      stdio: ['inherit', 'inherit', 'inherit', 'ipc']
    });
    compiler.on('message', (message) => { if (message?.kind === 'built') restart(); });
    compiler.once('error', fail);
    compiler.once('exit', (code) => { if (!stopping) void shutdown(code ?? 1); });
  } else restart();
}
