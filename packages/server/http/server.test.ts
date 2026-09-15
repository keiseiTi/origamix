import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApplicationDatabase } from '../database/database';
import { ProjectRepository } from '../projects/project-repository';
import { ProjectService } from '../projects/project-service';
import { createHttpServer } from './server';

const directories: string[] = [];
const templatePath = fileURLToPath(new URL('../../template', import.meta.url));

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('HTTP authentication and responses', () => {
  it('allows desktop renderer preflights while enforcing origins and session authentication', async () => {
    const database = new ApplicationDatabase(':memory:');
    const projects = new ProjectRepository(database);
    const server = createHttpServer({
      desktopToken: 'desktop-token',
      serviceInstanceId: 'service-instance',
      projects,
      projectService: new ProjectService(projects, templatePath),
    });
    try {
      for (const origin of ['http://127.0.0.1:5173', 'http://localhost:5173', 'null']) {
        const preflight = await server.inject({
          method: 'OPTIONS',
          url: '/api/v1/health',
          headers: {
            origin,
            'access-control-request-method': 'GET',
            'access-control-request-headers': 'authorization,x-origamix-service',
          },
        });
        expect(preflight.statusCode).toBe(204);
        expect(preflight.headers['access-control-allow-origin']).toBe(origin);
        expect(preflight.headers.vary).toBe('Origin');
        expect(preflight.headers['access-control-allow-headers']).toContain('Authorization');
        expect(preflight.headers['access-control-allow-headers']).toContain('X-Origamix-Service');

        const denied = await server.inject({
          method: 'GET',
          url: '/api/v1/health',
          headers: { origin },
        });
        expect(denied.statusCode).toBe(401);
        expect(denied.headers['access-control-allow-origin']).toBe(origin);
        expect(denied.json()).toEqual({
          success: false,
          code: 401,
          data: null,
          message: '桌面会话无效',
        });

        const response = await server.inject({
          method: 'GET',
          url: '/api/v1/health',
          headers: {
            origin,
            authorization: 'Bearer desktop-token',
            'x-origamix-service': 'service-instance',
          },
        });
        expect(response.statusCode).toBe(200);
        expect(response.headers['access-control-allow-origin']).toBe(origin);
        expect(response.json()).toMatchObject({ success: true, code: 200 });
      }
      for (const origin of [
        'https://example.com',
        'http://127.0.0.1:5174',
        'http://localhost:5173.evil.example',
      ]) {
        for (const method of ['OPTIONS', 'GET'] as const) {
          const denied = await server.inject({
            method,
            url: '/api/v1/health',
            headers: {
              origin,
              authorization: 'Bearer desktop-token',
              'x-origamix-service': 'service-instance',
            },
          });
          expect(denied.statusCode).toBe(403);
          expect(denied.headers['access-control-allow-origin']).toBeUndefined();
          expect(denied.json()).toEqual({
            success: false,
            code: 403,
            data: null,
            message: '请求来源不受信任',
          });
        }
      }
    } finally {
      await server.close();
      database.close();
    }
  });

  it('requires the desktop session and serves the versioned API', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-http-'));
    directories.push(directory);
    const database = new ApplicationDatabase(join(directory, 'origamix.db'));
    const projects = new ProjectRepository(database);
    const server = createHttpServer({
      desktopToken: 'desktop-token',
      serviceInstanceId: 'service-instance',
      projects,
      projectService: new ProjectService(projects, templatePath),
    });

    const denied = await server.inject({ method: 'GET', url: '/api/v1/projects' });
    expect(denied.statusCode).toBe(401);

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: { authorization: 'Bearer desktop-token', 'x-origamix-service': 'service-instance' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      code: 200,
      data: [],
    });
    expect(response.headers['x-request-id']).toBeTruthy();
    await server.close();
    database.close();
  });

  it('uses REST status codes and the uniform failure envelope', async () => {
    const database = new ApplicationDatabase(':memory:');
    const projects = new ProjectRepository(database);
    const server = createHttpServer({
      desktopToken: 'desktop-token',
      serviceInstanceId: 'service-instance',
      projects,
      projectService: new ProjectService(projects, templatePath),
    });
    const headers = {
      authorization: 'Bearer desktop-token',
      'x-origamix-service': 'service-instance',
    };
    try {
      const malformed = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers,
        payload: {},
      });
      expect(malformed.statusCode).toBe(400);
      expect(malformed.json()).toMatchObject({ success: false, code: 400, data: null });
      expect(malformed.json()).toHaveProperty('message');

      const missing = await server.inject({
        method: 'GET',
        url: '/api/v1/pages/page_missing/schema',
        headers: { ...headers, 'x-origamix-project-id': 'project_missing' },
      });
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toEqual({
        success: false,
        code: 404,
        data: null,
        message: '页面不存在',
      });

      const invalidGrant = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers,
        payload: {
          name: '测试项目',
          code: 'test-project',
          directoryGrantId: 'grant_missing',
        },
      });
      expect(invalidGrant.statusCode).toBe(422);
      expect(invalidGrant.json()).toEqual({
        success: false,
        code: 422,
        data: null,
        message: '目录授权已失效，请重新选择目录',
      });

      vi.spyOn(projects, 'listProjects').mockImplementation(() => {
        throw new Error('/private/user/project should not leak');
      });
      const unexpected = await server.inject({ method: 'GET', url: '/api/v1/projects', headers });
      expect(unexpected.statusCode).toBe(500);
      expect(unexpected.json()).toEqual({
        success: false,
        code: 500,
        data: null,
        message: '服务器内部错误',
      });
    } finally {
      await server.close();
      database.close();
    }
  });
});
