import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { contracts: 'src/contracts.ts', extensions: 'src/extensions.ts' },
  format: ['esm'],
  dts: true,
  clean: true,
  external: ['@origamix/shared', '@tangramino/base-editor', 'react'],
});
