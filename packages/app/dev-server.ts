import type { loadAppConfig } from './config.ts';
import { nanoid } from 'nanoid';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { prepareWebTemplate } from './template-download.ts';

const apiPrefix = '/api/v1';

// Development-only host integration. No secret is injected into client bundles.
export const mysqlWebDevelopment = (config: ReturnType<typeof loadAppConfig>): Plugin => {
  let closeBackend: (() => Promise<void>) | undefined;
  return {
    name: 'origamix-mysql-web-development',
    apply: 'serve',
    async configureServer(vite) {
      if (config.workbenchHost === 'desktop' || process.env.VITEST) return;
      const { mysqlUrl } = config;
      if (!mysqlUrl) throw new Error('Web 开发需要配置 ORIGAMIX_WEB_MYSQL_URL');
      const { startMysqlWebServer } = await import('@origamix/server/web-runtime');
      const stateDir = config.stateDir;
      await mkdir(stateDir, { recursive: true });
      const templatePath = resolve(stateDir, 'template');
      const templateDownload = await prepareWebTemplate(templatePath);
      const token = nanoid(48);
      const serviceInstanceId = nanoid();
      const port = vite.config.server.port ?? config.port;
      const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
      const backend = await startMysqlWebServer({
        mysqlUrl,
        templateDownload,
        desktopToken: token,
        serviceInstanceId,
        getModelCredential: async (provider) =>
          provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY?.trim() : undefined,
      });
      closeBackend = backend.close;
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
            request.removeHeader('Origin');
            request.setHeader('Authorization', `Bearer ${token}`);
            request.setHeader('X-Origamix-Service', serviceInstanceId);
          });
        },
      };
    },
    async closeBundle() {
      await closeBackend?.();
    },
  };
};
