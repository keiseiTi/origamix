// eslint-disable-next-line no-restricted-imports -- Build tooling only; never imported by material entries.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'antd/runtime': 'antd/runtime.ts',
    index: 'src/index.ts',
    'antd/editor': 'antd/editor.ts',
    'antd/manifest': 'antd/manifest.ts',
  },
  format: ['esm'],
  // Resolve through the declared export; tsup's legacy DTS resolver ignores export maps.
  dts: {
    compilerOptions: {
      paths: {
        '@origamix/shared': [fileURLToPath(import.meta.resolve('@origamix/shared'))],
      },
    },
  },
  noExternal: ['@origamix/shared'],
  clean: true,
  splitting: false,
  sourcemap: true,
  external: ['@origamix/ui', '@tangramino/base-editor', 'antd', 'react', 'react/jsx-runtime'],
});
