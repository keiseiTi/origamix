import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import electron from 'electron';

process.env.ORIGAMIX_ENV_LOCAL = '0';

const require = createRequire(import.meta.url);
const env: NodeJS.ProcessEnv = { ...process.env, ORIGAMIX_SERVER_PORT: '0' };
// Electron runs CommonJS fixtures; register tsx before loading their .cts entry.
env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ''} --require=${JSON.stringify(require.resolve('tsx/cjs'))}`;
delete env.ELECTRON_RUN_AS_NODE;
const resources = process.argv[2] === '--resources';
const script = resources ? './test-resources.cts' : './test-main.cts';
const args = process.argv.slice(resources ? 3 : 2);
const result = spawnSync(
  electron as unknown as string,
  [fileURLToPath(new URL(script, import.meta.url)), ...args],
  {
    env,
    stdio: 'inherit',
    timeout: 40000,
  },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
