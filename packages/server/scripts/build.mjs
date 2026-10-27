import { build } from 'tsup';
import { options } from './build-options.mjs';
import { dirname, resolve } from 'node:path';
const watch = process.argv.includes('--watch');
const root = resolve(dirname(options.entry.server), '../..');
await build({
  ...options,
  clean: !watch,
  watch: watch
    ? ['src', 'test/fixtures', 'test/helpers', '../shared/src'].map((path) => resolve(root, path))
    : false,
  onSuccess: async () => {
    process.send?.({ kind: 'built' });
  },
});
