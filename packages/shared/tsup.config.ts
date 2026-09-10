import { defineConfig } from 'tsup';

export default defineConfig({
  tsconfig: 'packages/shared/tsconfig.json',
  entry: {
    'credential-gateway': 'packages/shared/src/credential-gateway.ts',
    'desktop-api': 'packages/shared/src/desktop-api.ts',
    'page-window': 'packages/shared/src/page-window.ts',
    'protocol/agent-validation': 'packages/shared/src/protocol/agent-validation.ts',
    'protocol/agent': 'packages/shared/src/protocol/agent.ts',
    'protocol/api': 'packages/shared/src/protocol/api.ts',
    'protocol/schema': 'packages/shared/src/protocol/schema.ts',
    'protocol/validation': 'packages/shared/src/protocol/validation.ts',
  },
  outDir: 'packages/shared/dist',
  outExtension: () => ({ js: '.js' }),
  format: ['esm'],
  dts: true,
  clean: true,
  splitting: true,
  sourcemap: true,
  external: ['@sinclair/typebox', 'ajv', 'ajv-formats'],
});
