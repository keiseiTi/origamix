import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { nanoid } from 'nanoid';
import { createWebSessions, loginDocument } from './web-session';

const sendError = (response: ServerResponse, status: number, message: string) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ success: false, code: status, message, data: null }));
};

const loginPage = (response: ServerResponse, status = 200, message?: string) => {
  response.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy':
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
  });
  response.end(loginDocument(message));
};

const redirect = (response: ServerResponse, location: string) =>
  response.writeHead(303, { Location: location }).end();

const readLogin = async (request: IncomingMessage) => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 4096) return null;
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8')).get('password');
};

const assetTypes: Record<string, string> = {
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

export interface ProductionWebOptions {
  origin: URL;
  password: string;
  rendererDirectory: string;
}

export const createProductionWeb = async (
  options: ProductionWebOptions,
  modelConfigured: boolean,
) => {
  const { origin } = options;
  const index = (await readFile(join(options.rendererDirectory, 'index.html'), 'utf8')).replace(
    '<head>',
    `<head><base href="/"><meta name="origamix-web-host" content="production"><meta name="origamix-model-configured" content="${modelConfigured}">`,
  );
  const preview = await readFile(join(options.rendererDirectory, 'preview.html'));
  const sessions = createWebSessions(options.password, origin.protocol === 'https:');

  const setHeaders = (response: ServerResponse) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'same-origin');
  };

  const trustedOrigin = (request: IncomingMessage, api: boolean) => {
    if (
      request.headers.host !== origin.host ||
      !request.url?.startsWith('/') ||
      request.url.startsWith('//')
    )
      return false;
    const site = request.headers['sec-fetch-site'];
    const source = request.headers.origin;
    const safe = request.method === 'GET' || request.method === 'HEAD';
    return (
      (!source || source === origin.origin) &&
      (safe || source === origin.origin) &&
      (!site || site === 'same-origin' || (!api && safe))
    );
  };

  const handle = async (request: IncomingMessage, response: ServerResponse) => {
    setHeaders(response);
    response.setHeader('X-Request-Id', nanoid());
    if (
      request.headers.host !== origin.host ||
      !request.url?.startsWith('/') ||
      request.url.startsWith('//')
    )
      return sendError(response, 403, '请求来源不受信任');
    const { pathname } = new URL(request.url, origin);
    const auth = pathname.startsWith('/auth/');
    if (auth && !trustedOrigin(request, false)) return sendError(response, 403, '请求来源不受信任');

    if (pathname === '/auth/login') {
      if (request.method === 'GET') return loginPage(response);
      if (
        request.method !== 'POST' ||
        request.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded'
      )
        return sendError(response, 405, '请求方式不受支持');
      const password = await readLogin(request);
      if (!password || password.length > 512)
        return loginPage(response, 400, '请输入有效的访问密码');
      const status = sessions.login(request, response, password);
      if (status === 303) return redirect(response, '/');
      if (status === 429) response.setHeader('Retry-After', '60');
      return loginPage(
        response,
        status,
        status === 429 ? '尝试次数过多，请稍后再试' : '访问密码不正确',
      );
    }
    if (pathname === '/auth/logout' && request.method === 'POST') {
      sessions.logout(request, response);
      response.writeHead(204).end();
      return;
    }
    if (auth) return sendError(response, 404, '页面不存在');

    if (request.method !== 'GET' && request.method !== 'HEAD')
      return sendError(response, 405, '请求方式不受支持');
    if (!sessions.get(request)) {
      if (request.headers.accept?.includes('text/html')) return redirect(response, '/auth/login');
      return sendError(response, 401, '请先登录');
    }
    if (pathname === '/preview.html') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(request.method === 'HEAD' ? undefined : preview);
      return;
    }
    const asset = /^\/assets\/([\w.-]+)\.([a-z0-9]+)$/.exec(pathname);
    const type = asset && assetTypes[asset[2]];
    if (asset && type) {
      const assetPath = join(options.rendererDirectory, pathname);
      const file = await stat(assetPath).catch(() => undefined);
      if (!file?.isFile()) return sendError(response, 404, '文件不存在');
      response.setHeader('Content-Type', type);
      response.setHeader('Content-Length', file.size);
      response.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
      if (request.method === 'HEAD') response.end();
      else
        createReadStream(assetPath)
          .on('error', () => response.destroy())
          .pipe(response);
      return;
    }
    if (
      pathname === '/' ||
      (!pathname.startsWith('/assets/') && request.headers.accept?.includes('text/html'))
    ) {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.setHeader('X-Frame-Options', 'DENY');
      response.end(request.method === 'HEAD' ? undefined : index);
      return;
    }
    sendError(response, 404, '页面不存在');
  };
  return {
    setHeaders,
    trustedOrigin,
    session: sessions.get,
    close: sessions.close,
    serve: (request: IncomingMessage, response: ServerResponse) => {
      void handle(request, response).catch(() => {
        if (response.headersSent) response.destroy();
        else sendError(response, 500, 'Web 请求失败');
      });
    },
  };
};
