import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { canvasPrototype } from './canvas-prototype-plugin.ts';
import { localWebServer } from './dev-server.ts';

export default defineConfig({
  base: './',
  plugins: [tailwindcss(), react(), canvasPrototype(), localWebServer()],
  server: { port: 5173, strictPort: true },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
