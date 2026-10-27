import { loadAppConfig } from './config.ts';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { canvasPrototype } from './canvas-prototype-plugin.ts';
import { localWebServer } from './dev-server.ts';

export default defineConfig(() => {
  const config = loadAppConfig();
  return {
    base: './',
    envDir: false as const,
    plugins: [tailwindcss(), react(), canvasPrototype(), localWebServer()],
    server: {
      host: config.host,
      port: config.port,
      strictPort: true,
      watch: config.desktop
        ? {
            ignored: [
              '**/packages/materials/**',
              '**/packages/shared/**',
              '**/packages/runtime/**',
            ],
          }
        : undefined,
    },
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  };
});
