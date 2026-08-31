import { build } from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const desktopRoot = fileURLToPath(new URL('..', import.meta.url));
const root = fileURLToPath(new URL('../../..', import.meta.url));
const outdir = `${desktopRoot}/dist`;

await rm(outdir, { recursive: true, force: true });
await mkdir(`${outdir}/main`, { recursive: true });

const options = { bundle: true, platform: 'node', target: 'node20', format: 'cjs', sourcemap: true, external: ['electron'] };
await Promise.all([
  build({ ...options, entryPoints: [`${desktopRoot}/src/main/index.ts`], outfile: `${outdir}/main/index.cjs` }),
  build({ ...options, entryPoints: [`${desktopRoot}/src/preload/index.ts`], outfile: `${outdir}/preload/index.cjs` }),
  build({ ...options, entryPoints: [`${desktopRoot}/src/preload/preview.ts`], outfile: `${outdir}/preload/preview.cjs` }),
  build({ ...options, entryPoints: [`${root}/packages/server/index.ts`], outfile: `${outdir}/main/server.cjs` })
]);
