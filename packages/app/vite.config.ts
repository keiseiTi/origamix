import { loadAppConfig } from './config.ts';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { previewDocument } from './preview-document.ts';
import { mysqlWebDevelopment } from './dev-server.ts';

export default defineConfig(({ command }) => {
  const config = loadAppConfig(command === 'serve' ? 'development' : 'production');
  const { workbenchHost } = config;
  return {
    define: { __ORIGAMIX_WORKBENCH_HOST__: JSON.stringify(workbenchHost) },
    build: { outDir: `dist/${workbenchHost}` },
    base: './',
    envDir: false as const,
    plugins: [tailwindcss(), react(), previewDocument(), mysqlWebDevelopment(config)],
    server: {
      host: config.host,
      port: config.port,
      strictPort: true,
      watch:
        workbenchHost === 'desktop'
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
