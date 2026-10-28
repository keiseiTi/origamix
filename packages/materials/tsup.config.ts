// eslint-disable-next-line no-restricted-imports -- Build tooling only; never imported by material entries.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

const options: import('tsup').Options = {
  entry: {
    index: 'src/index.ts',
    'antd/editor': 'antd/editor.ts',
  },
  format: ['esm'],
  dts: {
    resolve: ['@origamix/shared', '@origamix/runtime'],
    compilerOptions: {
      paths: {
        '@': [fileURLToPath(new URL('./src/index.ts', import.meta.url))],
        '@/*': [fileURLToPath(new URL('./src/*', import.meta.url))],
        // Resolve the declared Shared entry for tsup's declaration bundler.
        '@origamix/shared': [
          fileURLToPath(new URL('./index.d.ts', import.meta.resolve('@origamix/shared'))),
        ],
        '@origamix/runtime': [
          fileURLToPath(new URL('./index.d.ts', import.meta.resolve('@origamix/runtime'))),
        ],
      },
    },
  },
  noExternal: ['@origamix/shared'],
  clean: true,
  splitting: false,
  sourcemap: true,
  external: ['@origamix/ui', 'antd', 'react', 'react/jsx-runtime'],
};
export default defineConfig([
  { ...options, outDir: 'dist/internal' },
  {
    ...options,
    entry: { 'antd/runtime': 'antd/runtime.ts', 'antd/manifest': 'antd/manifest.ts' },
    outDir: 'dist/public',
  },
]);
