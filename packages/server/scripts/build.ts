import { buildEntriesSequentially } from '../../../scripts/lib/build-entries.ts';
import { options } from './build-options.ts';
import { dirname, resolve } from 'node:path';
const watch = process.argv.includes('--watch');
const root = resolve(dirname(options.entry.server), '../..');
await buildEntriesSequentially({
  ...options,
  clean: !watch,
  watch: watch
    ? ['src', 'test/fixtures', 'test/helpers', '../shared/dist', '../materials/dist'].map((path) =>
        resolve(root, path),
      )
    : false,
  onSuccess: async () => {
    process.send?.({ kind: 'built' });
  },
});
