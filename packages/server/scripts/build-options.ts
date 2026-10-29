import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export const options = {
  tsconfig: `${root}tsconfig.json`,
  entry: {
    server: `${root}src/hosts/utility-process.ts`,
    runtime: `${root}src/server.ts`,
    tooling: `${root}src/tooling.ts`,
    template: `${root}src/templates/copy-template.ts`,
  },
  outDir: `${root}dist`,
  format: ['cjs' as const],
  outExtensions: () => ({ js: '.cjs' }),
  platform: 'node' as const,
  target: 'node24',
  outputOptions: { codeSplitting: false },
  sourcemap: true,
  dts: false,
  noExternal: [/^(?!node:).*/],
};
