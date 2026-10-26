import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  dts: true,
  clean: true,
  splitting: true,
  sourcemap: true,
  external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
});
