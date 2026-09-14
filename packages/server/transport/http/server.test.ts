import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApplicationDatabase } from '../../database/database';
import { ProjectRepository } from '../../repositories/project-repository';
import { WorkspaceRepository } from '../../repositories/workspace-repository';
import { ProjectService } from '../../services/project-service';
import { ProjectApplyService } from '../../services/project-apply-service';
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
      projectService: new ProjectService(projects, templatePath),
    });
    try {
      for (const origin of ['http://127.0.0.1:5173', 'http://localhost:5173', 'null']) {
        const preflight = await server.inject({
          method: 'OPTIONS',
          url: '/api/v1/workspace',
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
          url: '/api/v1/workspace',
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
          url: '/api/v1/workspace',
          headers: {
            origin,
            authorization: 'Bearer desktop-token',
            'x-origamix-service': 'service-instance',
          },
        });
        expect(response.statusCode).toBe(200);
        expect(response.headers['access-control-allow-origin']).toBe(origin);
        expect(response.json()).toMatchObject({
          success: true,
          code: 200,
          data: { theme: 'light' },
        });
      }
      for (const origin of [
        'https://example.com',
        'http://127.0.0.1:5174',
        'http://localhost:5173.evil.example',
      ]) {
        for (const method of ['OPTIONS', 'GET'] as const) {
          const denied = await server.inject({
            method,
            url: '/api/v1/workspace',
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
      projectService: new ProjectService(projects, templatePath),
    });

    const denied = await server.inject({ method: 'GET', url: '/api/v1/workspace' });
    expect(denied.statusCode).toBe(401);

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/workspace',
      headers: { authorization: 'Bearer desktop-token', 'x-origamix-service': 'service-instance' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      code: 200,
      data: { theme: 'light' },
    });
    expect(response.headers['x-request-id']).toBeTruthy();
    await server.close();
    database.close();
  });

  it('uses REST status codes and the uniform failure envelope', async () => {
    const database = new ApplicationDatabase(':memory:');
    const projects = new ProjectRepository(database);
    const workspace = new WorkspaceRepository(database);
    const server = createHttpServer({
      desktopToken: 'desktop-token',
      serviceInstanceId: 'service-instance',
      projects,
      workspace,
      projectService: new ProjectService(projects, templatePath),
    });
    const headers = {
      authorization: 'Bearer desktop-token',
      'x-origamix-service': 'service-instance',
    };
    try {
      const malformed = await server.inject({
        method: 'PATCH',
        url: '/api/v1/workspace',
        headers,
        payload: { theme: 'sepia' },
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

  it('creates a runnable project from the template and registers new pages', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-project-'));
    directories.push(directory);
    const database = new ApplicationDatabase(join(directory, 'origamix.db'));
    const projects = new ProjectRepository(database);
    const workspace = new WorkspaceRepository(database);
    const service = new ProjectService(projects, templatePath);
    service.registerGrant('grant_project', directory);
    const server = createHttpServer({
      desktopToken: 'desktop-token',
      serviceInstanceId: 'service-instance',
      projects,
      workspace,
      projectService: service,
      projectApplyService: new ProjectApplyService(projects),
    });
    const headers = {
      authorization: 'Bearer desktop-token',
      'x-origamix-service': 'service-instance',
    };
    const createProject = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers,
      payload: {
        name: '客户控制台',
        code: 'customer-console',
        directoryGrantId: 'grant_project',
      },
    });
    expect(createProject.statusCode).toBe(201);
    const projectResult = createProject.json() as {
      success: true;
      code: 200;
      data: { id: string; path: string };
    };
    expect(projectResult).toMatchObject({ success: true, code: 200 });
    const project = projectResult.data;
    expect(project.path).toBe(join(directory, 'customer-console'));
    expect(await readFile(join(project.path, 'README.md'), 'utf8')).toContain('客户控制台');
    expect(await readFile(join(project.path, 'package.json'), 'utf8')).toContain(
      'customer-console',
    );
    expect(await readFile(join(project.path, 'index.html'), 'utf8')).toContain(
      '<title>客户控制台</title>',
    );

    const createPage = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/pages`,
      headers,
      payload: { name: '客户列表', slug: 'customer-list' },
    });
    expect(createPage.statusCode).toBe(201);
    const pageResult = createPage.json() as {
      success: true;
      code: 200;
      data: { id: string; slug: string };
    };
    expect(pageResult).toMatchObject({ success: true, code: 200 });
    const page = pageResult.data;
    expect(page.slug).toBe('customer-list');
    expect(
      await readFile(join(project.path, 'src', 'pages', page.slug, 'index.tsx'), 'utf8'),
    ).toContain('OrigamixPage');
    expect(
      JSON.parse(await readFile(join(project.path, 'origamix.project.json'), 'utf8')),
    ).toMatchObject({
      framework: 'react',
      uiLibrary: 'antd',
      pages: [{ pageId: expect.any(String), route: '/customer-list' }],
    });

    const projectHeaders = { ...headers, 'x-origamix-project-id': project.id };
    const targetPath = join(project.path, 'src', 'pages', page.slug, 'schema.json');
    const targetBeforeEdit = await readFile(targetPath, 'utf8');
    const schemaResponse = await server.inject({
      method: 'GET',
      url: `/api/v1/pages/${page.id}/schema`,
      headers: projectHeaders,
    });
    const current = schemaResponse.json() as {
      success: true;
      data: { revisionId: string };
    };
    const saveResponse = await server.inject({
      method: 'POST',
      url: `/api/v1/pages/${page.id}/changesets`,
      headers: projectHeaders,
      payload: {
        pageId: page.id,
        baseRevisionId: current.data.revisionId,
        source: { kind: 'user' },
        createdAt: new Date().toISOString(),
        operation: 'updateElementProps',
        elementId: 'element_root',
        props: { padding: 28 },
      },
    });
    expect(saveResponse.statusCode).toBe(200);
    expect(await readFile(targetPath, 'utf8')).toBe(targetBeforeEdit);
    const saved = saveResponse.json() as { success: true; data: { revisionId: string } };
    const applyResponse = await server.inject({
      method: 'POST',
      url: `/api/v1/pages/${page.id}/apply`,
      headers: projectHeaders,
      payload: {
        expectedRevisionId: saved.data.revisionId,
        clientRequestId: 'deterministic_product_flow',
      },
    });
    expect(applyResponse.statusCode).toBe(200);
    expect(JSON.parse(await readFile(targetPath, 'utf8'))).toMatchObject({
      elements: { element_root: { props: { padding: 28 } } },
    });
    await server.close();
    database.close();
  });

  it('serializes page creation and keeps route/index projection aligned with an empty manifest', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-page-index-'));
    directories.push(directory);
    const database = new ApplicationDatabase(join(directory, 'origamix.db'));
    const projects = new ProjectRepository(database);
    const service = new ProjectService(projects, templatePath);
    service.registerGrant('grant_project', directory);
    const project = await service.createProject({
      name: '页面索引',
      code: 'page-index',
      directoryGrantId: 'grant_project',
    });

    await Promise.all([
      service.createPage(project.id, { name: '页面 A', slug: 'page-a', route: '/custom-a' }),
      service.createPage(project.id, { name: '页面 B', slug: 'page-b', route: '/custom-b' }),
    ]);
    expect(projects.listPages(project.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: 'page-a', route: '/custom-a' }),
        expect.objectContaining({ slug: 'page-b', route: '/custom-b' }),
      ]),
    );

    const manifestPath = join(project.path, 'origamix.project.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    await writeFile(manifestPath, `${JSON.stringify({ ...manifest, pages: [] }, null, 2)}\n`);
    await service.reconcile(project.path);
    expect(projects.listPages(project.id)).toEqual([]);
    database.close();
  });

  it('removes page files when creation fails before the manifest is committed', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-page-rollback-'));
    directories.push(directory);
    const database = new ApplicationDatabase(join(directory, 'origamix.db'));
    const projects = new ProjectRepository(database);
    const apply = new ProjectApplyService(projects);
    const service = new ProjectService(projects, templatePath, apply);
    service.registerGrant('grant_project', directory);
    const project = await service.createProject({
      name: '页面回滚',
      code: 'page-rollback',
      directoryGrantId: 'grant_project',
    });
    vi.spyOn(apply, 'initializeTarget').mockRejectedValueOnce(new Error('simulated write failure'));

    await expect(
      service.createPage(project.id, { name: '失败页面', slug: 'failed-page' }),
    ).rejects.toThrow('simulated write failure');
    await expect(access(join(project.path, 'src', 'pages', 'failed-page'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(
      JSON.parse(await readFile(join(project.path, 'origamix.project.json'), 'utf8')).pages,
    ).toEqual([]);
    database.close();
  });

  it('does not remove the winning page during concurrent creation of the same slug', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-page-same-slug-'));
    directories.push(directory);
    const database = new ApplicationDatabase(join(directory, 'origamix.db'));
    const projects = new ProjectRepository(database);
    const service = new ProjectService(projects, templatePath);
    service.registerGrant('grant_project', directory);
    const project = await service.createProject({
      name: '同名页面',
      code: 'same-slug',
      directoryGrantId: 'grant_project',
    });

    const results = await Promise.allSettled([
      service.createPage(project.id, { name: '页面 A', slug: 'same-page' }),
      service.createPage(project.id, { name: '页面 B', slug: 'same-page' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const manifest = JSON.parse(
      await readFile(join(project.path, 'origamix.project.json'), 'utf8'),
    ) as { pages: Array<{ slug: string }> };
    expect(manifest.pages).toEqual([expect.objectContaining({ slug: 'same-page' })]);
    await access(join(project.path, 'src', 'pages', 'same-page', 'schema.json'));
    database.close();
  });

  it('preserves a manifest-committed page and rebuilds its failed local index', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-page-recovery-'));
    directories.push(directory);
    const database = new ApplicationDatabase(join(directory, 'origamix.db'));
    const projects = new ProjectRepository(database);
    const service = new ProjectService(projects, templatePath);
    service.registerGrant('grant_project', directory);
    const project = await service.createProject({
      name: '页面恢复',
      code: 'page-recovery',
      directoryGrantId: 'grant_project',
    });
    const reconcile = vi.spyOn(projects, 'reconcile').mockImplementationOnce(() => {
      throw new Error('simulated index failure');
    });

    await expect(
      service.createPage(project.id, { name: '已落盘页面', slug: 'durable-page' }),
    ).rejects.toThrow('页面已创建，但本地索引更新失败');
    reconcile.mockRestore();
    const manifest = JSON.parse(
      await readFile(join(project.path, 'origamix.project.json'), 'utf8'),
    ) as { pages: Array<{ pageId: string; slug: string }> };
    expect(manifest.pages).toEqual([
      expect.objectContaining({ pageId: expect.any(String), slug: 'durable-page' }),
    ]);
    await access(join(project.path, 'src', 'pages', 'durable-page', 'schema.json'));

    await service.reconcile(project.path);
    expect(projects.listPages(project.id)).toEqual([
      expect.objectContaining({ id: manifest.pages[0]!.pageId, slug: 'durable-page' }),
    ]);
    database.close();
  });

  it('initializes a project manifest when opening an uninitialized directory', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-imported-project-'));
    directories.push(directory);
    const database = new ApplicationDatabase(join(directory, 'origamix.db'));
    const projects = new ProjectRepository(database);
    const service = new ProjectService(projects, templatePath);
    service.registerGrant('grant_existing', directory);

    const pending = await service.openProject({ directoryGrantId: 'grant_existing' });
    expect(pending.status).toBe('initialization_required');
    if (pending.status !== 'initialization_required') throw new Error('expected inspection');
    expect(pending.inspection).toMatchObject({
      directoryKind: 'empty',
      discoveredPages: [],
      blockers: [],
    });
    expect(pending.inspection.plannedChanges).toContain('生成完整项目模板');
    await expect(readFile(join(directory, 'origamix.project.json'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
    const opened = await service.openProject({
      directoryGrantId: 'grant_existing',
      initializeIfNeeded: true,
    });
    if (opened.status !== 'opened') throw new Error('expected opened project');
    const project = opened.project;
    const manifest = JSON.parse(
      await readFile(join(directory, 'origamix.project.json'), 'utf8'),
    ) as { name: string; code: string };

    expect(manifest).toMatchObject({ name: basename(directory), code: basename(directory) });
    expect(project.name).toBe(basename(directory));
    expect(manifest).toMatchObject({
      framework: 'react',
      uiLibrary: 'antd',
      pages: [],
    });
    await access(join(directory, 'src', 'router.ts'));
    await access(join(directory, 'vite.config.ts'));
    database.close();
  });

  it('discovers only standard Schema pages while initializing an existing React Vite project', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-existing-react-'));
    directories.push(directory);
    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({
        dependencies: {
          react: '^19.0.0',
          '@origamix/runtime': 'workspace:*',
          '@origamix/materials': 'workspace:*',
        },
        devDependencies: { vite: '^8.0.0' },
      }),
    );
    await mkdir(join(directory, 'src'), { recursive: true });
    await writeFile(join(directory, 'src', 'router.ts'), 'export default [];');
    const pagePath = join(directory, 'src', 'pages', 'customers');
    await mkdir(pagePath, { recursive: true });
    await writeFile(join(pagePath, 'index.tsx'), 'const Page = () => null; export default Page;');
    await writeFile(
      join(pagePath, 'schema.json'),
      JSON.stringify({
        elements: { element_root: { type: 'container', props: {} } },
        layout: { root: 'element_root', structure: { element_root: [] } },
        flows: {},
        bindElements: [],
        context: { globalVariables: [] },
        extensions: { origamix: { schemaVersion: '1.0' } },
      }),
    );
    const database = new ApplicationDatabase(join(directory, 'app.db'));
    const projects = new ProjectRepository(database);
    const service = new ProjectService(projects, templatePath);
    service.registerGrant('grant_existing', directory);
    const pending = await service.openProject({ directoryGrantId: 'grant_existing' });
    if (pending.status !== 'initialization_required') throw new Error('expected inspection');
    expect(pending.inspection).toEqual({
      directoryKind: 'existing_application',
      discoveredPages: [{ name: 'customers', slug: 'customers', route: '/customers' }],
      plannedChanges: ['写入 origamix.project.json', '按发现页面建立本地索引和工作副本'],
      blockers: [],
    });
    const opened = await service.openProject({
      directoryGrantId: 'grant_existing',
      initializeIfNeeded: true,
    });
    if (opened.status !== 'opened') throw new Error('expected opened project');
    expect(projects.listPages(opened.project.id)).toEqual([
      expect.objectContaining({ name: 'customers', slug: 'customers', route: '/customers' }),
    ]);
    database.close();
  });

  it('reports initialization blockers without writing a project manifest', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-existing-blocked-'));
    directories.push(directory);
    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({ dependencies: { react: '^19.0.0' }, devDependencies: { vite: '^8.0.0' } }),
    );
    const pagePath = join(directory, 'src', 'pages', 'customers');
    await mkdir(pagePath, { recursive: true });
    await writeFile(join(pagePath, 'index.tsx'), 'const Page = () => null; export default Page;');
    await writeFile(
      join(pagePath, 'schema.json'),
      JSON.stringify({
        elements: { element_root: { type: 'container', props: {} } },
        layout: { root: 'element_root', structure: { element_root: [] } },
        flows: {},
        bindElements: [],
        context: { globalVariables: [] },
        extensions: { origamix: { schemaVersion: '1.0' } },
      }),
    );
    const database = new ApplicationDatabase(join(directory, 'app.db'));
    const projects = new ProjectRepository(database);
    const service = new ProjectService(projects, templatePath);
    service.registerGrant('grant_existing', directory);

    const pending = await service.openProject({ directoryGrantId: 'grant_existing' });
    if (pending.status !== 'initialization_required') throw new Error('expected inspection');
    expect(pending.inspection.blockers).toEqual([
      '已有页面需要声明 @origamix/runtime 与 @origamix/materials 依赖',
      '已有页面需要挂载标准 src/router.ts',
    ]);
    await expect(
      service.openProject({ directoryGrantId: 'grant_existing', initializeIfNeeded: true }),
    ).rejects.toThrow('项目尚不能初始化');
    await expect(readFile(join(directory, 'origamix.project.json'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
    database.close();
  });

  it('renames and duplicates records while desktop deletion preserves project files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-lifecycle-'));
    directories.push(directory);
    const database = new ApplicationDatabase(join(directory, 'origamix.db'));
    const projects = new ProjectRepository(database);
    const workspace = new WorkspaceRepository(database);
    const service = new ProjectService(projects, templatePath);
    service.registerGrant('grant_project', directory);
    const project = await service.createProject({
      name: '原项目',
      code: 'lifecycle-project',
      directoryGrantId: 'grant_project',
    });
    const originalPage = await service.createPage(project.id, {
      name: '首页',
      slug: 'home',
      route: '/',
    });
    const server = createHttpServer({
      desktopToken: 'desktop-token',
      serviceInstanceId: 'service-instance',
      projects,
      workspace,
      projectService: service,
    });
    const headers = {
      authorization: 'Bearer desktop-token',
      'x-origamix-service': 'service-instance',
      'x-origamix-project-id': project.id,
    };
    expect(
      (
        await server.inject({
          method: 'PATCH',
          url: `/api/v1/projects/${project.id}`,
          headers,
          payload: { name: '新项目名' },
        })
      ).json().data,
    ).toMatchObject({ name: '新项目名' });
    expect(
      (
        await server.inject({
          method: 'PATCH',
          url: `/api/v1/pages/${originalPage.id}`,
          headers,
          payload: { name: '新页面名' },
        })
      ).json().data,
    ).toMatchObject({ name: '新页面名', slug: 'home' });
    const duplicate = await server.inject({
      method: 'POST',
      url: `/api/v1/pages/${originalPage.id}/duplicate`,
      headers,
      payload: {},
    });
    expect(duplicate.statusCode).toBe(201);
    const duplicatePage = duplicate.json().data as { id: string; slug: string };
    expect(duplicatePage.slug).toBe('home-copy');
    const duplicatePath = join(project.path, 'src', 'pages', duplicatePage.slug, 'schema.json');
    await access(duplicatePath);
    const timestamp = new Date().toISOString();
    database.connection
      .prepare(
        'INSERT INTO conversations (id, project_id, page_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        'conversation_lifecycle',
        project.id,
        duplicatePage.id,
        'test',
        'active',
        timestamp,
        timestamp,
      );
    database.connection
      .prepare(
        'INSERT INTO messages (id, conversation_id, role, content_json, status, sequence, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        'message_lifecycle',
        'conversation_lifecycle',
        'user',
        '{"version":"1","blocks":[]}',
        'completed',
        0,
        timestamp,
        timestamp,
      );
    database.connection
      .prepare(
        `INSERT INTO agent_runs (
          id, project_id, page_id, conversation_id, user_message_id, client_request_id,
          base_revision_id, model_ref, mode, status, budget_json, prompt_version,
          policy_version, toolset_version, material_manifest_version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'run_lifecycle',
        project.id,
        duplicatePage.id,
        'conversation_lifecycle',
        'message_lifecycle',
        'request_lifecycle',
        'revision_base',
        'fake/model',
        'page_modify',
        'completed',
        '{"maxModelCalls":1,"maxToolCalls":1,"maxOutputTokens":1,"maxDurationMs":1,"maxSchemaBytes":1,"maxRepairAttempts":0}',
        '1',
        '1',
        '1',
        '1',
        timestamp,
        timestamp,
      );
    database.connection
      .prepare(
        'INSERT INTO runtime_diagnostics (project_id, page_id, revision_id, code, severity, stage, safe_message, observed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        project.id,
        duplicatePage.id,
        'revision_test',
        'TEST',
        'warning',
        'render',
        'test',
        timestamp,
      );
    expect(
      (
        await server.inject({
          method: 'DELETE',
          url: `/api/v1/pages/${duplicatePage.id}`,
          headers,
          payload: { scope: 'desktop_record' },
        })
      ).json().data,
    ).toEqual({ deleted: true });
    expect(projects.getPage(project.id, duplicatePage.id)).toBeUndefined();
    for (const table of ['conversations', 'messages', 'agent_runs', 'runtime_diagnostics']) {
      expect(
        database.connection.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get(),
      ).toMatchObject({ count: 0 });
    }
    await access(duplicatePath);
    await service.renameProject(project.id, '再次改名');
    expect(projects.getPage(project.id, duplicatePage.id)).toBeUndefined();
    expect(
      (
        await server.inject({
          method: 'DELETE',
          url: `/api/v1/projects/${project.id}`,
          headers,
          payload: { scope: 'desktop_record' },
        })
      ).json().data,
    ).toEqual({ deleted: true });
    expect(projects.getProject(project.id)).toBeUndefined();
    await access(join(project.path, 'origamix.project.json'));
    await server.close();
    database.close();
  });
});
