import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const entry = join(dirname(require.resolve('vite/package.json')), 'bin/vite.js');
process.argv[1] = entry;
await import(pathToFileURL(entry).href);
