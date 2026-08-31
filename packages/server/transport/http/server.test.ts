import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { ApplicationDatabase } from '../../database/database';
import { ProjectRepository } from '../../repositories/project-repository';
import { WorkspaceRepository } from '../../repositories/workspace-repository';
import { ProjectService } from '../../services/project-service';
import { createHttpServer } from './server';

const directories: string[] = [];
const templatePath = fileURLToPath(new URL('../../../template', import.meta.url));

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('local HTTP API', () => {
  it('allows desktop renderer preflights while enforcing origins and session authentication', async () => {
    const database = new ApplicationDatabase(':memory:');
    const projects = new ProjectRepository(database);
    const workspace = new WorkspaceRepository(database);
    const server = createHttpServer({
      desktopToken: 'desktop-token',
      serviceInstanceId: 'service-instance',
      projects,
      workspace,
      projectService: new ProjectService(projects, workspace, templatePath)
    });
    try {
      for (const origin of ['http://127.0.0.1:5173', 'http://localhost:5173', 'null']) {
        const preflight = await server.inject({
          method: 'OPTIONS', url: '/api/v1/workspace',
          headers: {
            origin,
            'access-control-request-method': 'GET',
            'access-control-request-headers': 'authorization,x-origamix-service'
          }
        });
        expect(preflight.statusCode).toBe(204);
        expect(preflight.headers['access-control-allow-origin']).toBe(origin);
        expect(preflight.headers.vary).toBe('Origin');
        expect(preflight.headers['access-control-allow-headers']).toContain('Authorization');
        expect(preflight.headers['access-control-allow-headers']).toContain('X-Origamix-Service');

        const denied = await server.inject({
          method: 'GET', url: '/api/v1/workspace', headers: { origin }
        });
        expect(denied.statusCode).toBe(401);
        expect(denied.headers['access-control-allow-origin']).toBe(origin);

        const response = await server.inject({
          method: 'GET', url: '/api/v1/workspace',
          headers: { origin, authorization: 'Bearer desktop-token', 'x-origamix-service': 'service-instance' }
        });
        expect(response.statusCode).toBe(200);
        expect(response.headers['access-control-allow-origin']).toBe(origin);
        expect(response.json()).toMatchObject({ ok: true, data: { theme: 'light' } });
      }
      for (const origin of ['https://example.com', 'http://127.0.0.1:5174', 'http://localhost:5173.evil.example']) {
        for (const method of ['OPTIONS', 'GET'] as const) {
          const denied = await server.inject({
            method, url: '/api/v1/workspace',
            headers: { origin, authorization: 'Bearer desktop-token', 'x-origamix-service': 'service-instance' }
          });
          expect(denied.statusCode).toBe(403);
          expect(denied.headers['access-control-allow-origin']).toBeUndefined();
        }
      }
    } finally {
      await server.close();
      database.close();
    }
  });

  it('requires the desktop session and serves workspace through the versioned API', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-http-'));
    directories.push(directory);
    const database = new ApplicationDatabase(join(directory, 'origamix.db'));
    const projects = new ProjectRepository(database);
    const workspace = new WorkspaceRepository(database);
    const server = createHttpServer({
      desktopToken: 'desktop-token',
      serviceInstanceId: 'service-instance',
      projects,
      workspace,
      projectService: new ProjectService(projects, workspace, templatePath)
    });

    const denied = await server.inject({ method: 'GET', url: '/api/v1/workspace' });
    expect(denied.statusCode).toBe(401);

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/workspace',
      headers: { authorization: 'Bearer desktop-token', 'x-origamix-service': 'service-instance' }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, data: { theme: 'light' } });
    await server.close();
    database.close();
  });

  it('creates a runnable project from the template and registers new pages', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-project-'));
    directories.push(directory);
    const database = new ApplicationDatabase(join(directory, 'origamix.db'));
    const projects = new ProjectRepository(database);
    const workspace = new WorkspaceRepository(database);
    const service = new ProjectService(projects, workspace, templatePath);
    service.registerGrant('grant_project', directory);

    const project = await service.createProject({
      name: '客户控制台',
      code: 'customer-console',
      directoryGrantId: 'grant_project'
    });
    expect(project.path).toBe(join(directory, 'customer-console'));
    expect(await readFile(join(project.path, 'README.md'), 'utf8')).toContain('客户控制台');
    expect(await readFile(join(project.path, 'package.json'), 'utf8')).toContain(
      'customer-console'
    );
    expect(await readFile(join(project.path, 'index.html'), 'utf8')).toContain(
      '<title>客户控制台</title>'
    );

    const page = await service.createPage(project.id, { name: '客户列表', slug: 'customer-list' });
    expect(page.slug).toBe('customer-list');
    expect(
      await readFile(join(project.path, 'src', 'pages', page.slug, 'index.tsx'), 'utf8')
    ).toContain('客户列表');
    expect(await readFile(join(project.path, 'src', 'router.ts'), 'utf8')).toContain(
      '/customer-list'
    );
    database.close();
  });

  it('initializes a project manifest when opening an uninitialized directory', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-imported-project-'));
    directories.push(directory);
    const database = new ApplicationDatabase(join(directory, 'origamix.db'));
    const projects = new ProjectRepository(database);
    const workspace = new WorkspaceRepository(database);
    const service = new ProjectService(projects, workspace, templatePath);
    service.registerGrant('grant_existing', directory);

    const project = await service.openProject({ directoryGrantId: 'grant_existing' });
    const manifest = JSON.parse(
      await readFile(join(directory, 'origamix.project.json'), 'utf8')
    ) as { name: string; code: string };

    expect(manifest).toMatchObject({ name: basename(directory), code: basename(directory) });
    expect(project.name).toBe(basename(directory));
    expect(await readFile(join(directory, 'src', 'pages', 'registry.json'), 'utf8')).toBe('[]\n');
    database.close();
  });
});
