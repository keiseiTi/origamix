import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    contracts: 'src/contracts.ts',
    extensions: 'src/extensions.ts',
    index: 'src/index.ts',
    components: 'src/components/index.ts',
    core: 'src/core/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  splitting: true,
  sourcemap: true,
  external: [
    'react',
    'react-dom',
    'react-dom/client',
    'react/jsx-runtime',
    '@tangramino/base-editor',
  ],
});
