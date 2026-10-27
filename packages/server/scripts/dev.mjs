import { loadServerConfig } from './config.mjs';
import { fileURLToPath } from 'node:url';
import { runDevelopment } from './dev-supervisor.mjs';

loadServerConfig();
runDevelopment({ entry: fileURLToPath(new URL('./dev-worker.mjs', import.meta.url)) });
