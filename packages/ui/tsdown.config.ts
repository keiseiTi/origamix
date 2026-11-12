import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/components/index.ts' },
  format: ['esm'],
  fixedExtension: false,
  dts: true,
  clean: true,
  outputOptions: { codeSplitting: true },
  sourcemap: true,
  unbundle: true,
  deps: {
    neverBundle: ['react', 'react-dom', 'react/jsx-runtime', '@uiw/react-color-chrome'],
  },
});
