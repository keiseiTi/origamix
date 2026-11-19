import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import {
  createServer,
  request as requestHttp,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { join } from 'node:path';
import { nanoid } from 'nanoid';
import { startMysqlWebServer } from '@origamix/server/web-runtime';
import { createWebSessions, loginDocument } from './web-session.ts';
import { loadWebTemplate } from './web-template-assets.ts';

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

const requestHeaders = [
  'accept',
  'content-type',
  'content-length',
  'last-event-id',
  'x-request-id',
];
const responseHeaders = [
  'content-type',
  'content-length',
  'content-disposition',
  'cache-control',
  'x-request-id',
  'x-template-sha256',
];

const proxyApi = (
  request: IncomingMessage,
  response: ServerResponse,
  target: { port: number; token: string; serviceInstanceId: string },
  session: AbortSignal,
) => {
  const headers = {
    ...Object.fromEntries(
      requestHeaders
        .map((name) => [name, request.headers[name]])
        .filter(([, value]) => value !== undefined),
    ),
    authorization: `Bearer ${target.token}`,
    'x-origamix-service': target.serviceInstanceId,
  };
  const upstream = requestHttp(
    {
      hostname: '127.0.0.1',
      port: target.port,
      path: request.url,
      method: request.method,
      headers,
      signal: session,
    },
    (result) => {
      for (const name of responseHeaders) {
        const value = result.headers[name];
        if (value !== undefined) response.setHeader(name, value);
      }
      response.setHeader('X-Accel-Buffering', 'no');
      response.writeHead(result.statusCode ?? 502);
      response.flushHeaders();
      result.on('error', () => response.destroy());
      result.pipe(response);
    },
  );
  upstream.on('error', () => {
    if (response.destroyed) return;
    if (response.headersSent) response.destroy();
    else if (session.aborted) {
      response.setHeader('X-Origamix-Session-Required', '1');
      sendError(response, 401, '会话已结束，请重新登录');
    } else sendError(response, 503, '后端暂时不可用');
  });
  response.once('close', () => upstream.destroy());
  request.pipe(upstream);
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

interface WebHostOptions {
  origin: URL;
  password: string;
  host: string;
  port: number;
  stateDirectory: string;
  rendererDirectory: string;
  templateDirectory: string;
  modelKey?: string;
  mysqlUrl: string;
}

export const startProductionWeb = async (options: WebHostOptions) => {
  const { origin } = options;
  const mysqlUrl = options.mysqlUrl?.trim();
  if (!mysqlUrl) throw new Error('Web 宿主需要配置 ORIGAMIX_WEB_MYSQL_URL');
  const index = (await readFile(join(options.rendererDirectory, 'index.html'), 'utf8')).replace(
    '<head>',
    `<head><base href="/"><meta name="origamix-web-host" content="production"><meta name="origamix-model-configured" content="${Boolean(options.modelKey)}"><meta name="origamix-host" content="web">`,
  );
  const preview = await readFile(join(options.rendererDirectory, 'preview.html'));
  await mkdir(options.stateDirectory, { recursive: true });
  const staging = await mkdtemp(join(options.stateDirectory, 'template-'));
  const sessions = createWebSessions(options.password, origin.protocol === 'https:');
  let backend: { port: number; close: () => Promise<void> } | undefined;

  try {
    const templateDownload = await loadWebTemplate(options.templateDirectory, staging);
    const token = nanoid(48);
    const serviceInstanceId = nanoid();
    const credentials = { desktopToken: token, serviceInstanceId, templateDownload };
    backend = await startMysqlWebServer({
      ...credentials,
      mysqlUrl,
      getModelCredential: async () => options.modelKey,
    });
    const target = { port: backend.port, token, serviceInstanceId };
    const handle = async (request: IncomingMessage, response: ServerResponse) => {
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Referrer-Policy', 'same-origin');
      if (
        request.headers.host !== origin.host ||
        !request.url?.startsWith('/') ||
        request.url.startsWith('//')
      )
        return sendError(response, 403, '请求来源不受信任');
      const { pathname } = new URL(request.url, origin);
      const api = pathname === '/api/v1' || pathname.startsWith('/api/v1/');
      const auth = pathname.startsWith('/auth/');
      if (api || auth) {
        const site = request.headers['sec-fetch-site'];
        const source = request.headers.origin;
        const safeMethod = request.method === 'GET' || request.method === 'HEAD';
        if (
          (source && source !== origin.origin) ||
          (!safeMethod && source !== origin.origin) ||
          (site && site !== 'same-origin' && (api || !safeMethod))
        )
          return sendError(response, 403, '请求来源不受信任');
      }

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

      const session = sessions.get(request);
      if (api) {
        if (!session) {
          response.setHeader('X-Origamix-Session-Required', '1');
          return sendError(response, 401, '会话已结束，请重新登录');
        }
        return proxyApi(request, response, target, session);
      }
      if (request.method !== 'GET' && request.method !== 'HEAD')
        return sendError(response, 405, '请求方式不受支持');
      if (!session) {
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
    const server = createServer((request, response) => {
      void handle(request, response).catch(() => {
        if (response.headersSent) response.destroy();
        else sendError(response, 500, 'Web 宿主请求失败');
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(options.port, options.host, () => {
        server.off('error', reject);
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('无法取得 Web 服务端口');
    return {
      port: address.port,
      close: async () => {
        sessions.close();
        const stopped = new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
        server.closeAllConnections();
        await stopped;
        await backend?.close();
        await rm(staging, { recursive: true, force: true });
      },
    };
  } catch (error) {
    sessions.close();
    await backend?.close();
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
};
