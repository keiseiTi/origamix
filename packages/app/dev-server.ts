import { loadWebUpstream, type loadAppConfig } from './config.ts';
import type { Plugin } from 'vite';

const apiPrefix = '/api/v1';

// Development-only host integration. No secret is injected into client bundles.
export const webDevelopmentProxy = (config: ReturnType<typeof loadAppConfig>): Plugin => {
  return {
    name: 'origamix-web-development-proxy',
    apply: 'serve',
    configureServer(vite) {
      if (config.workbenchHost === 'desktop' || process.env.VITEST) return;
      const { port: upstreamPort, token, serviceInstanceId } = loadWebUpstream('development');
      const port = vite.config.server.port ?? config.port;
      const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
      vite.middlewares.use((request, response, next) => {
        const path = request.url?.split('?')[0];
        if (path !== apiPrefix && !path?.startsWith(`${apiPrefix}/`)) return next();
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
      vite.config.server.proxy[`^${apiPrefix}(?:/|\\?|$)`] = {
        target: `http://127.0.0.1:${upstreamPort}`,
        configure(proxy) {
          proxy.on('proxyReq', (request) => {
            request.removeHeader('Origin');
            request.setHeader('Authorization', `Bearer ${token}`);
            request.setHeader('X-Origamix-Service', serviceInstanceId);
          });
        },
      };
    },
  };
};
