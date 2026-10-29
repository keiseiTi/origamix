import { defineConfig } from 'tsdown';

export default defineConfig({
  tsconfig: 'tsconfig.json',
  entry: { index: 'src/index.ts' },
  outDir: 'dist',
  outExtensions: () => ({ js: '.js' }),
  format: ['esm'],
  fixedExtension: false,
  dts: true,
  clean: true,
  outputOptions: { codeSplitting: false },
  sourcemap: true,
  external: ['@sinclair/typebox', 'ajv', 'ajv-formats'],
});
