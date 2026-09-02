import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import { localWebServer } from './dev-server.ts';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  plugins: [tailwindcss(), react(), wasm(), localWebServer()],
  server: { port: 5173, strictPort: true },
  resolve: {
    alias: {
      '@': '/src',
      '@tangramino/base-editor': resolve(
        __dirname,
        '../../../tangramino/packages/base-editor/dist/index.js',
      ),
    },
  },
});
