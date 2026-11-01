import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/index.ts' },
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
    alwaysBundle: ['@origamix/shared'],
    neverBundle: ['react', 'react/jsx-runtime'],
  },
  clean: true,
});
