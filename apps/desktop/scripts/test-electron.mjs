import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import electron from 'electron';

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const resources = process.argv[2] === '--resources';
const script = resources ? './test-resources.cjs' : './test-main.cjs';
const args = process.argv.slice(resources ? 3 : 2);
const result = spawnSync(electron, [fileURLToPath(new URL(script, import.meta.url)), ...args],
  { env, stdio: 'inherit', timeout: 40000 });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
