import { defineConfig } from 'tsup';

export default defineConfig({
  tsconfig: 'tsconfig.json',
  entry: {
    'credential-gateway': 'src/credential-gateway.ts',
    'desktop-api': 'src/desktop-api.ts',
    'page-window': 'src/page-window.ts',
    'protocol/agent-validation': 'src/protocol/agent-validation.ts',
    'protocol/agent': 'src/protocol/agent.ts',
    'protocol/api': 'src/protocol/api.ts',
    'protocol/project-manifest': 'src/protocol/project-manifest.ts',
    'protocol/schema': 'src/protocol/schema.ts',
    'protocol/validation': 'src/protocol/validation.ts',
  },
  outDir: 'dist',
  outExtension: () => ({ js: '.js' }),
  format: ['esm'],
  dts: true,
  clean: true,
  splitting: true,
  sourcemap: true,
  external: ['@sinclair/typebox', 'ajv', 'ajv-formats'],
});
