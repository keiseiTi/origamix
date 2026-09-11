import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

// Development-only host integration. No secret is injected into client bundles.
export const localWebServer = (): Plugin => {
  return {
    name: 'origamix-local-web-server',
    apply: 'serve',
    async configureServer(vite) {
      if (process.env.ORIGAMIX_DESKTOP === '1' || process.env.VITEST) return;
      const { startServer } = await import('@origamix/server/runtime');
      const stateDir =
        process.env.ORIGAMIX_WEB_STATE_DIR ??
        fileURLToPath(new URL('../../.origamix-web/', import.meta.url));
      await mkdir(stateDir, { recursive: true });
      const token = randomUUID();
      const serviceInstanceId = randomUUID();
      const port = vite.config.server.port ?? 5173;
      const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
      const backend = await startServer({
        databasePath: resolve(stateDir, 'origamix.db'),
        templatePath: fileURLToPath(new URL('../template', import.meta.url)),
        desktopToken: token,
        serviceInstanceId,
        allowedOrigins: [...hosts].map((host) => `http://${host}`),
        projectPath: process.env.ORIGAMIX_WEB_PROJECT_DIR,
        getModelCredential: async (provider) =>
          provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY?.trim() : undefined,
      });
      vite.middlewares.use((request, response, next) => {
        if (!/^\/api\/v1(?:\/|$)/.test(request.url ?? '')) return next();
        const origin = request.headers.origin;
        if (
          !hosts.has(request.headers.host ?? '') ||
          (origin && ![...hosts].some((host) => origin === `http://${host}`)) ||
          request.headers['sec-fetch-site'] === 'cross-site'
        ) {
          response.writeHead(403).end('Untrusted local API request');
          return;
        }
        next();
      });
      vite.config.server.proxy ??= {};
      vite.config.server.proxy['/api/v1'] = {
        target: `http://127.0.0.1:${backend.port}`,
        configure(proxy) {
          proxy.on('proxyReq', (request) => {
            request.setHeader('Authorization', `Bearer ${token}`);
            request.setHeader('X-Origamix-Service', serviceInstanceId);
          });
        },
      };
      vite.httpServer?.once('close', () => {
        void backend.close();
      });
    },
  };
};
