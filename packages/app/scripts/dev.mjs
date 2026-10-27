import { loadAppConfig } from '../config.ts';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { runDevelopment } from '@origamix/server/development';

const require = createRequire(import.meta.url);
const config = loadAppConfig();
runDevelopment({
  entry: join(dirname(require.resolve('vite/package.json')), 'bin/vite.js'),
  args: process.argv.slice(2),
  watchServer: !config.desktop,
});
