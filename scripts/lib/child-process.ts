import type { ChildProcess } from 'node:child_process';

export const stopChild = async (child: ChildProcess | undefined, timeout = 3000) => {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });
};
