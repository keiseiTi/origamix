import { defineConfig } from 'tsup';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  entry: { index: 'index.ts' },
  format: ['esm'],
  dts: {
    resolve: ['@origamix/shared'],
    compilerOptions: {
      paths: { '@origamix/shared': [fileURLToPath(import.meta.resolve('@origamix/shared'))] },
    },
  },
  clean: true,
  noExternal: ['@origamix/shared'],
  external: ['react', 'react/jsx-runtime'],
});
