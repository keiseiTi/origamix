import { loadServerConfig, loadWebServerConfig } from './config.ts';
import { fileURLToPath } from 'node:url';
import { runDevelopment } from './dev-supervisor.ts';

const web = process.argv.includes('--web');
if (web) loadWebServerConfig(true);
else loadServerConfig();
runDevelopment({
  entry: fileURLToPath(new URL(web ? './web-worker.ts' : './dev-worker.ts', import.meta.url)),
  args: web ? ['--development'] : [],
});
