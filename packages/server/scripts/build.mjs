import { build } from 'tsup';
import { options } from './build-options.mjs';
import { dirname, resolve } from 'node:path';
const watch = process.argv.includes('--watch');
const root = dirname(options.entry.server);
await build({
  ...options,
  clean: !watch,
  watch: watch
    ? [
        'index.ts',
        'runtime.ts',
        'tooling.ts',
        'template.ts',
        'database',
        'errors.ts',
        'infrastructure',
        'projects',
        'schema',
        'conversations',
        'agent',
        'diagnostics',
        'http',
        'evaluation',
        'testing',
        '../shared/src',
      ].map((path) => resolve(root, path))
    : false,
  onSuccess: async () => {
    process.send?.({ kind: 'built' });
  },
});
