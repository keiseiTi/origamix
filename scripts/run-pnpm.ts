import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const workspaceRoot = fileURLToPath(new URL('../', import.meta.url));

export const runPnpm = (...args: string[]) => {
  const result = spawnSync('pnpm', args, { cwd: workspaceRoot, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};
