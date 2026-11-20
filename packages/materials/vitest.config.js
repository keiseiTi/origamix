import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      {
        find: /^antd\/(editor|manifest|runtime|validation)$/,
        replacement: fileURLToPath(new URL('./antd/', import.meta.url)) + '$1',
      },
    ],
  },
});
