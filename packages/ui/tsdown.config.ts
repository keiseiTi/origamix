import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/components/index.ts' },
  format: ['esm'],
  fixedExtension: false,
  dts: true,
  clean: true,
  outputOptions: { codeSplitting: false },
  sourcemap: true,
  external: ['react', 'react-dom', 'react/jsx-runtime'],
});
