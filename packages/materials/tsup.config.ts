import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'antd/index': 'antd/index.ts',
    'antd/group': 'antd/group.ts',
    'antd/manifest': 'antd/manifest.ts',
    'src/material-manifest': 'src/material-manifest.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  splitting: true,
  sourcemap: true,
  external: ['@heroui/react', '@tangramino/base-editor', 'antd', 'react', 'react/jsx-runtime'],
});
