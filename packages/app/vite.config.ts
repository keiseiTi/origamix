import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { localWebServer } from './dev-server.ts';

export default defineConfig({
  base: './',
  plugins: [tailwindcss(), react(), localWebServer()],
  server: { port: 5173, strictPort: true },
});
