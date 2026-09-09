import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { react: 'react.tsx' },
  format: ['esm'],
  dts: true,
  clean: true,
  external: ['react', 'react/jsx-runtime'],
});
