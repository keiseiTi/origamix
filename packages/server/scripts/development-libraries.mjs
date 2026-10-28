import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

export const libraryNames = ['shared', 'runtime', 'materials'];
export const libraryWatchPaths = Object.fromEntries(
  libraryNames.map((name) => [
    name,
    [
      `packages/${name}/src`,
      `packages/${name}/package.json`,
      `packages/${name}/tsup.config.ts`,
      `packages/${name}/tsconfig.json`,
      ...(name === 'shared' ? ['tsconfig.base.json'] : []),
      ...(name === 'materials' ? ['packages/materials/antd'] : []),
    ],
  ]),
);
export const expandLibraryChanges = (batch) => {
  if (batch.has('shared')) for (const name of libraryNames) batch.add(name);
  if (batch.has('runtime')) batch.add('materials');
  if (batch.has('materials')) batch.add('server');
  return batch;
};
export const buildLibraries = async (batch, root, run) => {
  const require = createRequire(import.meta.url);
  const cli = join(
    dirname(require.resolve('tsup/package.json')),
    require('tsup/package.json').bin.tsup,
  );
  expandLibraryChanges(batch);
  for (const name of libraryNames)
    if (batch.has(name)) await run(cli, join(root, 'packages', name));
};
