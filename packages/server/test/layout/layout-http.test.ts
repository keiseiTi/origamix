import { mkdtemp, writeFile, readFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { Value } from '@sinclair/typebox/value';
import { LayoutWorkingStateSchema, LayoutRevisionHistorySchema } from '@origamix/shared';
import { ApplicationDatabase } from '../../src/database/database';
import { ProjectRepository } from '../../src/projects/project-repository';
import { ProjectService } from '../../src/projects/project-service';
import { LayoutService } from '../../src/layout/layout-service';
import { createHttpServer } from '../../src/http/server';

// Authentication and HTTP adaptation only; mutation/recovery matrices belong to the layout service.
it('protects layout endpoints with the existing boundary and exposes project-scoped Working and revisions', async () => {
  const path = await mkdtemp(join(tmpdir(), 'origamix-layout-http-'));
  const database = new ApplicationDatabase(join(path, 'test.db'));
  const projects = new ProjectRepository(database);
  const projectService = new ProjectService(projects, 'unused');
  const server = createHttpServer({
    desktopToken: 'fake-token',
    serviceInstanceId: 'fake-instance',
    projects,
    projectService,
    layoutService: new LayoutService(projects),
  });
  try {
    // Open a valid authorized project, rather than inventing an arbitrary-path layout endpoint.
    await writeFile(
      join(path, 'origamix.project.json'),
      JSON.stringify({
        projectId: 'project_test',
        name: '测试',
        framework: 'react',
        materialSet: { id: 'official-antd', version: '1.0.0' },
        pageDirectory: 'pages',
        pages: [],
      }),
    );
    projectService.registerGrant('grant', path);
    await projectService.openProject({ directoryGrantId: 'grant' });
    const request = {
      method: 'POST' as const,
      url: '/api/v1/layout/working/get',
      payload: { projectId: 'project_test' },
    };
    expect((await server.inject(request)).statusCode).toBe(401);
    const headers = { authorization: 'Bearer fake-token', 'x-origamix-service': 'fake-instance' };
    expect(
      (
        await server.inject({
          ...request,
          headers: { ...headers, origin: 'https://untrusted.example' },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await server.inject({
          ...request,
          headers,
          payload: { ...request.payload, path: '/tmp/arbitrary' },
        })
      ).statusCode,
    ).toBe(400);
    const configRequest = { ...request, url: '/api/v1/layout/config/get', headers };
    const manifestPath = join(path, 'origamix.project.json');
    const originalManifest = await readFile(manifestPath, 'utf8');
    expect((await server.inject(configRequest)).json().data).toEqual({
      name: '布局配置',
      enabled: false,
    });
    expect(await readFile(manifestPath, 'utf8')).toBe(originalManifest);
    expect((await server.inject({ ...request, headers })).statusCode).toBe(409);
    await expect(access(join(path, '.origamix', 'layout'))).rejects.toThrow();
    const toggle = (enabled: boolean) =>
      server.inject({
        ...request,
        url: '/api/v1/layout/config/update',
        headers,
        payload: { projectId: 'project_test', enabled },
      });
    expect((await toggle(true)).json().data).toEqual({ name: '布局配置', enabled: true });
    expect(JSON.parse(await readFile(manifestPath, 'utf8')).layout).toEqual({ enabled: true });
    expect(
      (
        await server.inject({
          ...configRequest,
          url: '/api/v1/layout/config/update',
          payload: { projectId: 'project_test', enabled: true, name: '重命名' },
        })
      ).statusCode,
    ).toBe(400);
    const working = await server.inject({ ...request, headers });
    expect(working.statusCode).toBe(200);
    expect(working.json()).toMatchObject({
      success: true,
      code: 200,
      data: { workingVersion: 1, revisionId: null },
    });
    expect(Value.Check(LayoutWorkingStateSchema, working.json().data)).toBe(true);
    const saved = await server.inject({
      method: 'POST',
      url: '/api/v1/layout/revisions/save',
      headers,
      payload: { projectId: 'project_test', expectedWorkingVersion: 1 },
    });
    expect(saved.statusCode).toBe(200);
    const history = await server.inject({
      method: 'POST',
      url: '/api/v1/layout/revisions/list',
      headers,
      payload: request.payload,
    });
    expect(Value.Check(LayoutRevisionHistorySchema, history.json().data)).toBe(true);
    expect(history.json().data.revisions).toHaveLength(1);
    const savedState = saved.json().data;
    expect((await toggle(false)).statusCode).toBe(200);
    expect(JSON.parse(await readFile(manifestPath, 'utf8')).layout).toEqual({ enabled: false });
    expect((await server.inject({ ...request, headers })).statusCode).toBe(409);
    expect((await toggle(true)).statusCode).toBe(200);
    expect((await server.inject({ ...request, headers })).json().data).toEqual(savedState);

    expect(
      (await server.inject({ ...request, headers, payload: { projectId: 'project_other' } }))
        .statusCode,
    ).toBe(404);
  } finally {
    await server.close();
    database.close();
    await rm(path, { recursive: true, force: true });
  }
});
