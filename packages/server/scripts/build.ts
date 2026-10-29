import { rm as cleanOutput } from 'node:fs/promises';
import { build as buildEntries, type InlineConfig } from 'tsdown';

const build = async (config: InlineConfig) => {
  if (config.clean && config.outDir)
    await cleanOutput(config.outDir, { recursive: true, force: true });
  const pending = new Set(Object.keys(config.entry as Record<string, string>));
  const onSuccess = config.onSuccess;
  for (const [name, entry] of Object.entries(config.entry as Record<string, string>)) {
    await buildEntries({
      ...config,
      entry: { [name]: entry },
      clean: false,
      onSuccess:
        typeof onSuccess === 'function'
          ? async (options, signal) => {
              pending.delete(name);
              if (!pending.size) await onSuccess(options, signal);
            }
          : onSuccess,
    });
  }
};
import { options } from './build-options.ts';
import { dirname, resolve } from 'node:path';
const watch = process.argv.includes('--watch');
const root = resolve(dirname(options.entry.server), '../..');
await build({
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
