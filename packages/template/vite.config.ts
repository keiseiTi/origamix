import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import manifest from './origamix.project.json' with { type: 'json' };
import { readRoutingConfig } from './src/routing-config.ts';

// https://vite.dev/config/
export default defineConfig({
  base: readRoutingConfig(manifest).basePath,
  plugins: [react(), tailwindcss()],
  server: {
    port: 8901,
  },
});
