import { fileURLToPath } from 'node:url';

export const desktopRoot = fileURLToPath(new URL('../', import.meta.url));
export const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url));

export const options = {
  tsconfig: `${desktopRoot}tsconfig.json`,
  entry: {
    'main/index': `${desktopRoot}src/main/index.ts`,
    'preload/index': `${desktopRoot}src/preload/index.ts`,
  },
  outDir: `${desktopRoot}dist`,
  format: ['cjs'],
  outExtension: () => ({ js: '.cjs' }),
  platform: 'node',
  // Prefix-only builtins such as node:sqlite cannot be loaded as "sqlite".
  removeNodeProtocol: false,
  target: 'node24',
  bundle: true,
  splitting: false,
  sourcemap: true,
  dts: false,
  // Keep sandboxed preloads self-contained; Electron is provided by the host.
  external: ['electron'],
  noExternal: [/^(?!electron$).*/],
};
