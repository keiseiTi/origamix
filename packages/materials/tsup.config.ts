// eslint-disable-next-line no-restricted-imports -- Build tooling only; never imported by material entries.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'antd/index': 'antd/index.ts',
    'antd/runtime': 'antd/runtime.ts',
    'antd/editor': 'antd/editor.ts',
    'antd/group': 'antd/group.ts',
    'antd/manifest': 'antd/manifest.ts',
    'src/material-manifest': 'src/material-manifest.ts',
    'src/origamix-material': 'src/origamix-material.ts',
  },
  format: ['esm'],
  // Resolve through the declared export; tsup's legacy DTS resolver ignores export maps.
  dts: {
    compilerOptions: {
      paths: {
        '@origamix/shared/protocol/material-manifest': [
          fileURLToPath(import.meta.resolve('@origamix/shared/protocol/material-manifest')),
        ],
      },
    },
  },
  noExternal: ['@origamix/shared'],
  clean: true,
  splitting: false,
  sourcemap: true,
  external: ['@heroui/react', '@tangramino/base-editor', 'antd', 'react', 'react/jsx-runtime'],
});
