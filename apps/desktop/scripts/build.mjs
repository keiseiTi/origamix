import { build } from 'tsup';
import { cp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { prepareTemplateArtifact } from '@origamix/server/template-artifact';
import { options, desktopRoot, workspaceRoot } from './tsup-options.mjs';

await build({ ...options, clean: true });
const require = createRequire(import.meta.url);
await cp(require.resolve('@origamix/server/utility'), `${desktopRoot}dist/main/server.cjs`);
await cp(
  `${require.resolve('@origamix/server/utility')}.map`,
  `${desktopRoot}dist/main/server.cjs.map`,
);
// TODO(post-MVP): publish @origamix/runtime and @origamix/materials to npm, then replace
// these vendored file dependencies with pinned registry versions in the generated template.
await prepareTemplateArtifact({
  sourceTemplate: `${workspaceRoot}packages/template`,
  targetTemplate: `${desktopRoot}dist/template`,
  runtimePackage: `${workspaceRoot}packages/runtime`,
  materialsPackage: `${workspaceRoot}packages/materials`,
});
