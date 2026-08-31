import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import electron from 'electron';

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const script = process.argv[2] ? './smoke.cjs' : './smoke-main.cjs';
const result = spawnSync(electron, [fileURLToPath(new URL(script, import.meta.url)), ...process.argv.slice(2)],
  { env, stdio: 'inherit', timeout: 40000 });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
