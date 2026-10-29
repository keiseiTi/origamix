import { defineConfig } from 'tsdown';

const options: import('tsdown').UserConfig = {
  entry: {
    index: 'src/index.ts',
    'antd/editor': 'antd/editor.ts',
  },
  format: ['esm'],
  fixedExtension: false,
  dts: true,
  deps: {
    dts: {
      alwaysBundle: ['@origamix/shared', '@origamix/runtime'],
      neverBundle: [
        '@sinclair/typebox',
        'ajv',
        'ajv-formats',
        'react',
        'react/jsx-runtime',
        'antd',
        '@origamix/ui',
      ],
    },
  },
  noExternal: ['@origamix/shared'],
  clean: true,
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
