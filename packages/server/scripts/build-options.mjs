import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export const options = {
  tsconfig: `${root}tsconfig.json`,
  entry: {
    server: `${root}index.ts`,
    runtime: `${root}runtime.ts`,
    tooling: `${root}tooling.ts`,
    template: `${root}template.ts`,
  },
  outDir: `${root}dist`,
  format: ['cjs'],
  outExtension: () => ({ js: '.cjs' }),
  platform: 'node',
  target: 'node24',
  removeNodeProtocol: false,
  bundle: true,
  splitting: false,
  sourcemap: true,
  dts: false,
  noExternal: [/^(?!node:).*/],
};
