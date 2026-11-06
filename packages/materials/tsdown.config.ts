import { defineConfig } from 'tsdown';

const options: import('tsdown').UserConfig = {
  entry: {
    index: 'src/index.ts',
    'antd/editor': 'antd/editor.ts',
    'antd/layout/editor': 'antd/layout/editor.ts',
  },
  format: ['esm'],
  platform: 'browser',
  fixedExtension: false,
  dts: true,
  deps: {
    neverBundle: ['@origamix/editor', '@origamix/runtime'],
    dts: {
      alwaysBundle: ['@origamix/shared', '@origamix/runtime'],
      neverBundle: [
        '@origamix/editor',
        '@sinclair/typebox',
        'ajv',
        'ajv-formats',
        'react',
        'react/jsx-runtime',
        'lucide-react',
        'antd',
        '@origamix/ui',
      ],
    },
  },
  clean: true,
  sourcemap: true,
};
export default defineConfig([
  { ...options, outDir: 'dist/internal' },
  {
    ...options,
    entry: {
      'antd/runtime': 'antd/runtime.ts',
      'antd/layout/runtime': 'antd/layout/runtime.ts',
      'antd/layout/manifest': 'antd/layout/manifest.ts',
      'antd/manifest': 'antd/manifest.ts',
      'antd/validation': 'antd/validation.ts',
    },
    outDir: 'dist/public',
  },
]);
