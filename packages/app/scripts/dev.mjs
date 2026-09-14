import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { runDevelopment } from '@origamix/server/development';

const require = createRequire(import.meta.url);
runDevelopment({
  entry: join(dirname(require.resolve('vite/package.json')), 'bin/vite.js'),
  args: process.argv.slice(2),
  watchServer: process.env.ORIGAMIX_DESKTOP !== '1',
});
