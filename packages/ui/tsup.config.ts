import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/components/index.ts' },
  format: ['esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  external: ['react', 'react-dom', 'react/jsx-runtime'],
});
