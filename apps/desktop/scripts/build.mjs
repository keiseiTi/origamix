import { build } from 'tsup';
import { cp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { copyTemplate } from '@origamix/server/template';
import { options, desktopRoot, workspaceRoot } from './tsup-options.mjs';

await build({ ...options, clean: true });
const require = createRequire(import.meta.url);
await cp(require.resolve('@origamix/server/utility'), `${desktopRoot}dist/main/server.cjs`);
await cp(`${require.resolve('@origamix/server/utility')}.map`, `${desktopRoot}dist/main/server.cjs.map`);
// tsup only cleans compiled outputs; explicitly replace the generated scaffold.
await rm(`${desktopRoot}dist/template`, { recursive: true, force: true });
await copyTemplate(`${workspaceRoot}packages/template`, `${desktopRoot}dist/template`);
