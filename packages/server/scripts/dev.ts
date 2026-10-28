import { loadServerConfig } from './config.ts';
import { fileURLToPath } from 'node:url';
import { runDevelopment } from './dev-supervisor.ts';

loadServerConfig();
runDevelopment({ entry: fileURLToPath(new URL('./dev-worker.ts', import.meta.url)) });
