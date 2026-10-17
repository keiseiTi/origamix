import { defineConfig } from 'tsup';

export default defineConfig({
  tsconfig: 'tsconfig.json',
  entry: { index: 'src/index.ts' },
  outDir: 'dist',
  outExtension: () => ({ js: '.js' }),
  format: ['esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  external: ['@sinclair/typebox', 'ajv', 'ajv-formats'],
});
