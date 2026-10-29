import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

export const libraryNames = ['shared', 'runtime', 'materials'];
export const libraryWatchPaths = Object.fromEntries(
  libraryNames.map((name) => [
    name,
    [
      `packages/${name}/src`,
      `packages/${name}/package.json`,
      `packages/${name}/tsdown.config.ts`,
      `packages/${name}/tsconfig.json`,
      ...(name === 'shared' ? ['tsconfig.base.json'] : []),
      ...(name === 'materials' ? ['packages/materials/antd'] : []),
    ],
  ]),
);
export const expandLibraryChanges = (batch: Set<string>) => {
  if (batch.has('shared')) for (const name of libraryNames) batch.add(name);
  if (batch.has('runtime')) batch.add('materials');
  if (batch.has('materials')) batch.add('server');
  return batch;
};
export const buildLibraries = async (
  batch: Set<string>,
  root: string,
  run: (entry: string, cwd: string) => Promise<void>,
) => {
  const require = createRequire(import.meta.url);
  const cli = join(
    dirname(require.resolve('tsdown/package.json')),
    require('tsdown/package.json').bin.tsdown,
  );
  expandLibraryChanges(batch);
  for (const name of libraryNames)
    if (batch.has(name)) await run(cli, join(root, 'packages', name));
};
