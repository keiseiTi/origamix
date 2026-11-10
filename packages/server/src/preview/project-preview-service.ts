import { createServer, type Server } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import type {
  ProjectPreviewLaunch,
  ProjectPreviewSession,
  ProjectPreviewSnapshot,
} from '@origamix/shared';
import type { ProjectRepository } from '../projects/project-repository';
import { ProjectSnapshotReader } from './project-snapshot';
import { conflict, invalid, notFound } from '../errors';

interface Session {
  projectId: string;
  cookie: string;
  snapshot: ProjectPreviewSnapshot;
  server: Server;
  url: string;
}
const mime: Record<string, string> = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

/** Each preview gets an isolated loopback origin and a cookie provisioned by Main, never a URL token. */
export class ProjectPreviewService {
  private readonly sessions = new Map<string, Session>();
  private readonly reader: ProjectSnapshotReader;
  private stopped = false;
  constructor(
    projects: Pick<ProjectRepository, 'getProject'>,
    private readonly assetDirectory?: string,
  ) {
    this.reader = new ProjectSnapshotReader(projects);
  }
  private scoped = (input: ProjectPreviewSession) => {
    const session = this.sessions.get(input.sessionId);
    if (!session || session.projectId !== input.projectId) throw notFound('项目预览会话不存在');
    return session;
  };
  open = async (projectId: string): Promise<ProjectPreviewLaunch> => {
    if (this.stopped) throw conflict('服务正在关闭');
    if (!this.assetDirectory) throw conflict('当前宿主未提供项目预览资源，请使用桌面应用');
    const assetDirectory = resolve(this.assetDirectory);
    // Fail before opening a window if the built-in application has not been built.
    const index = await readFile(resolve(assetDirectory, 'index.html'), 'utf8').catch(() => {
      throw conflict('内置预览资源尚未构建，请先构建应用');
    });
    const snapshot = await this.reader.read(projectId);
    const id = randomBytes(20).toString('hex');
    const cookie = randomBytes(32).toString('hex');
    const listener = createServer((request, response) => {
      void (async () => {
        const entry = this.sessions.get(id);
        const provided =
          request.headers.cookie
            ?.split(';')
            .map((item) => item.trim())
            .find((item) => item.startsWith('origamix_preview='))
            ?.slice('origamix_preview='.length) ?? '';
        const authorized =
          provided.length === cookie.length &&
          timingSafeEqual(Buffer.from(provided), Buffer.from(cookie));
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.setHeader('Referrer-Policy', 'no-referrer');
        if (!entry) {
          response.writeHead(401).end();
          return;
        }
        const expected = new URL(entry.url).origin;
        if (
          request.headers.host !== new URL(expected).host ||
          (request.headers.origin && request.headers.origin !== expected)
        ) {
          response.writeHead(403).end();
          return;
        }
        if (request.method !== 'GET') {
          response.writeHead(405).end();
          return;
        }
        const path = decodeURIComponent(new URL(request.url ?? '/', expected).pathname);
        if (path.startsWith('/__origamix/') && !authorized) {
          response.writeHead(401).end();
          return;
        }
        if (path === '/__origamix/snapshot') {
          await this.reader.assertEnabled(projectId);
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(entry.snapshot));
        } else if (path === '/__origamix/status') {
          try {
            const next = await this.reader.read(projectId);
            response.setHeader('Content-Type', 'application/json');
            response.end(
              JSON.stringify({
                active: true,
                updated: next.snapshotId !== entry.snapshot.snapshotId,
                hasUnappliedChanges: next.hasUnappliedChanges,
              }),
            );
          } catch (error) {
            // A disabled/deleted project invalidates this entire session; malformed new content remains retryable.
            try {
              await this.reader.assertEnabled(projectId);
            } catch {
              response.writeHead(410).end(JSON.stringify({ active: false }));
              return;
            }
            response.writeHead(409).end(
              JSON.stringify({
                message: error instanceof Error ? error.message : '项目内容无法读取',
              }),
            );
          }
        } else if (path === '/__origamix/refresh') {
          const next = await this.reader.read(projectId);
          entry.snapshot = next;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(next));
        } else if (path.startsWith('/assets/') && mime[extname(path)]) {
          const file = resolve(assetDirectory, path.slice(1));
          if (!file.startsWith(`${assetDirectory}${sep}assets${sep}`) || !mime[extname(file)]) {
            response.writeHead(404).end();
            return;
          }
          response.setHeader('Content-Type', mime[extname(file)]!);
          response.end(await readFile(file));
        } else {
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          // Static built-in code only. Absolute assets work under Browser basename and Hash prefixes.
          response.end(
            index
              .replace('<head>', '<head><meta name="origamix-project-preview" content="true">')
              .replaceAll('./assets/', '/assets/'),
          );
        }
      })().catch((error) => {
        if (!response.headersSent) response.writeHead(422, { 'Content-Type': 'application/json' });
        response.end(
          JSON.stringify({ message: error instanceof Error ? error.message : '项目预览读取失败' }),
        );
      });
    });
    await new Promise<void>((resolvePromise, reject) => {
      listener.once('error', reject);
      listener.listen(0, '127.0.0.1', () => {
        listener.removeListener('error', reject);
        resolvePromise();
      });
    });
    if (this.stopped) {
      listener.close();
      throw conflict('服务正在关闭');
    }
    const address = listener.address();
    if (!address || typeof address === 'string') {
      listener.close();
      throw invalid('预览监听地址无效');
    }
    const url = `http://127.0.0.1:${address.port}/__origamix/preview`;
    this.sessions.set(id, { projectId, cookie, snapshot, server: listener, url });
    return { sessionId: id, projectId, cookie, url };
  };
  status = async (input: ProjectPreviewSession) => {
    this.scoped(input);
    try {
      await this.reader.assertEnabled(input.projectId);
      return { active: true };
    } catch {
      await this.end(input);
      return { active: false };
    }
  };
  end = async (input: ProjectPreviewSession): Promise<void> => {
    const session = this.sessions.get(input.sessionId);
    if (!session) return;
    if (session.projectId !== input.projectId) throw notFound('项目预览会话不存在');
    this.sessions.delete(input.sessionId);
    session.server.closeAllConnections();
    await new Promise<void>((resolvePromise) => session.server.close(() => resolvePromise()));
  };
  endProject = async (projectId: string) => {
    await Promise.all(
      [...this.sessions]
        .filter(([, entry]) => entry.projectId === projectId)
        .map(([sessionId]) => this.end({ sessionId, projectId })),
    );
  };
  close = async () => {
    this.stopped = true;
    await Promise.all(
      [...this.sessions].map(([sessionId, entry]) =>
        this.end({ sessionId, projectId: entry.projectId }),
      ),
    );
  };
}
