import { loadAppConfig } from './config.ts';
import { nanoid } from 'nanoid';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { prepareWebTemplate } from './template-download.ts';

const apiPrefix = '/api/v1';

// Development-only host integration. No secret is injected into client bundles.
export const localWebServer = (): Plugin => {
  return {
    name: 'origamix-local-web-server',
    apply: 'serve',
    async configureServer(vite) {
      const config = loadAppConfig();
      if (config.desktop || process.env.VITEST) return;
      const { startServer } = await import('@origamix/server/runtime');
      const stateDir = config.stateDir;
      await mkdir(stateDir, { recursive: true });
      const templatePath = resolve(stateDir, 'template');
      const templateDownload = await prepareWebTemplate(templatePath);
      const token = nanoid(48);
      const serviceInstanceId = nanoid();
      const port = vite.config.server.port ?? config.port;
      const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
      const backend = await startServer({
        port: config.serverPort,
        databasePath: resolve(stateDir, 'origamix.db'),
        templatePath,
        templateDownload,
        desktopToken: token,
        serviceInstanceId,
        allowedOrigins: [...hosts].map((host) => `http://${host}`),
        projectPath: config.projectPath,
        getModelCredential: async (provider) =>
          provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY?.trim() : undefined,
      });
      vite.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith(apiPrefix)) return next();
        const origin = request.headers.origin;
        const fetchSite = request.headers['sec-fetch-site'];
        if (
          !hosts.has(request.headers.host ?? '') ||
          (origin && ![...hosts].some((host) => origin === `http://${host}`)) ||
          fetchSite !== 'same-origin'
        ) {
          response.writeHead(403).end('Untrusted local API request');
          return;
        }
        next();
      });
      vite.config.server.proxy ??= {};
      vite.config.server.proxy[apiPrefix] = {
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
