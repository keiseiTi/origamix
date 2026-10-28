import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import electron from 'electron';

const require = createRequire(import.meta.url);
const env = { ...process.env };
// Electron runs CommonJS fixtures; register tsx before loading their .cts entry.
env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ''} --require=${JSON.stringify(require.resolve('tsx/cjs'))}`;
delete env.ELECTRON_RUN_AS_NODE;
const state = mkdtempSync(join(tmpdir(), 'origamix-live-quality-'));
env.ORIGAMIX_QUALITY_STATE_DIR = state;
const cleanup = () =>
  rmSync(state, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
const child = spawn(
  electron as unknown as string,
  [fileURLToPath(new URL('./evaluate-agent.cts', import.meta.url)), ...process.argv.slice(2)],
  { env, stdio: 'inherit' },
);
const stop = () => child.kill('SIGTERM');
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
child.once('error', (error) => {
  cleanup();
  console.error(error.message);
  process.exitCode = 1;
});
child.once('exit', (code) => {
  // Electron can flush its Chromium caches after the Main process exit hook.
  cleanup();
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
  process.exitCode = code ?? 1;
});
