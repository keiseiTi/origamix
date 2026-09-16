import { cp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { desktopRoot } from './build-options.mjs';

const require = createRequire(import.meta.url);

export const copyServerArtifact = async () => {
  const serverArtifact = require.resolve('@origamix/server/utility');
  await cp(serverArtifact, `${desktopRoot}dist/main/server.cjs`);
  await cp(`${serverArtifact}.map`, `${desktopRoot}dist/main/server.cjs.map`);
};
