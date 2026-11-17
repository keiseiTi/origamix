import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

const lifetime = 12 * 60 * 60 * 1000;
const maxSessions = 32;
const loginWindow = 60_000;
const digest = (value: string) => createHash('sha256').update(value).digest();

export const createWebSessions = (password: string, secure: boolean) => {
  const expected = digest(password);
  const name = secure ? '__Host-origamix-session' : 'origamix-loopback-session';
  const sessions = new Map<string, { controller: AbortController; timer: NodeJS.Timeout }>();
  let attempts = 0;
  let windowEnds = 0;

  const cookie = (id: string, maxAge: number) =>
    `${name}=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
  const getId = (request: IncomingMessage) =>
    request.headers.cookie
      ?.split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? '';
  const revoke = (id: string) => {
    const session = sessions.get(id);
    if (!session) return;
    clearTimeout(session.timer);
    sessions.delete(id);
    session.controller.abort();
  };

  return {
    get: (request: IncomingMessage) => sessions.get(getId(request))?.controller.signal,
    login: (request: IncomingMessage, response: ServerResponse, supplied: string) => {
      const now = Date.now();
      if (now >= windowEnds) {
        attempts = 0;
        windowEnds = now + loginWindow;
      }
      if (attempts >= 8) return 429;
      if (!timingSafeEqual(expected, digest(supplied))) {
        attempts += 1;
        return 401;
      }
      attempts = 0;
      revoke(getId(request));
      const oldest = sessions.keys().next().value;
      if (sessions.size >= maxSessions && oldest) revoke(oldest);
      const id = randomBytes(32).toString('base64url');
      const timer = setTimeout(() => revoke(id), lifetime).unref();
      sessions.set(id, { controller: new AbortController(), timer });
      response.setHeader('Set-Cookie', cookie(id, lifetime / 1000));
      return 303;
    },
    logout: (request: IncomingMessage, response: ServerResponse) => {
      revoke(getId(request));
      response.setHeader('Set-Cookie', cookie('', 0));
    },
    close: () => {
      for (const id of sessions.keys()) revoke(id);
    },
  };
};

export const loginDocument = (message = '') => `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><title>登录 Origamix</title>
<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;font:16px system-ui;background:Canvas;color:CanvasText}main{width:min(22rem,calc(100% - 3rem))}form{display:grid;gap:.75rem}input,button{box-sizing:border-box;font:inherit;padding:.65rem;border-radius:.5rem}input{border:1px solid GrayText}button{background:CanvasText;color:Canvas;border:0;cursor:pointer}p{margin:0}</style></head>
<body><main><h1>登录 Origamix</h1><form method="post" action="/auth/login">
<label for="password">访问密码</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="512">
${message ? `<p role="alert">${message}</p>` : ''}<button type="submit">登录</button></form></main></body></html>`;
