import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { ApplicationDatabase } from '../../database/database';
import { ProjectRepository } from '../../projects/project-repository';
import { ProjectService } from '../../projects/project-service';
import { ProjectApplyService } from '../../schema/project-apply-service';
import { createHttpServer } from '../../http/server';

const directories: string[] = [];
const templatePath = fileURLToPath(new URL('../../../template', import.meta.url));

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('Project and Schema HTTP flows', () => {
  it('creates a runnable project from the template and registers new pages', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-project-'));
    directories.push(directory);
    const database = new ApplicationDatabase(join(directory, 'origamix.db'));
    const projects = new ProjectRepository(database);
    const service = new ProjectService(projects, templatePath);
    service.registerGrant('grant_project', directory);
    const server = createHttpServer({
      desktopToken: 'desktop-token',
      serviceInstanceId: 'service-instance',
      projects,
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
        pageDirectory: 'screens',
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
      await readFile(join(project.path, 'src', 'screens', page.slug, 'index.tsx'), 'utf8'),
    ).toContain('OrigamixPage');
    expect(
      JSON.parse(await readFile(join(project.path, 'origamix.project.json'), 'utf8')),
    ).toMatchObject({
      framework: 'react',
      uiLibrary: 'antd',
      pageDirectory: 'screens',
      pages: [{ pageId: expect.any(String), slug: 'customer-list' }],
    });

    const projectHeaders = { ...headers, 'x-origamix-project-id': project.id };
    const targetPath = join(project.path, 'src', 'screens', page.slug, 'schema.json');
    const targetBeforeEdit = await readFile(targetPath, 'utf8');
    const workingBeforeResponse = await server.inject({
      method: 'GET',
      url: `/api/v1/pages/${page.id}/working-state`,
      headers: projectHeaders,
    });
    const workingBefore = workingBeforeResponse.json() as {
      success: true;
      data: {
        revisionId: string;
        workingVersion: number;
        schema: {
          elements: Record<string, { type: string; props: Record<string, unknown> }>;
        };
      };
    };
    const draftResponse = await server.inject({
      method: 'POST',
      url: `/api/v1/pages/${page.id}/working-operations`,
      headers: projectHeaders,
      payload: {
        baseWorkingVersion: workingBefore.data.workingVersion,
        operations: [
          {
            operation: 'updateElementProps',
            elementId: 'element_root',
            set: { padding: 28 },
          },
        ],
      },
    });
    expect(draftResponse.statusCode, draftResponse.body).toBe(200);
    expect(await readFile(targetPath, 'utf8')).toBe(targetBeforeEdit);
    const draft = draftResponse.json() as {
      success: true;
      data: { revisionId: string; workingVersion: number };
    };
    expect(draft.data.revisionId).toBe(workingBefore.data.revisionId);
    const workingStateResponse = await server.inject({
      method: 'GET',
      url: `/api/v1/pages/${page.id}/working-state`,
      headers: projectHeaders,
    });
    expect(workingStateResponse.statusCode).toBe(200);
    const workingState = workingStateResponse.json() as {
      success: true;
      data: {
        revisionId: string;
        workingVersion: number;
        workingHash: string;
        savedSchemaHash: string;
      };
    };
    expect(workingState.data).toMatchObject({
      revisionId: workingBefore.data.revisionId,
    });
    expect(workingState.data.workingHash).not.toBe(workingState.data.savedSchemaHash);
    const checkpointResponse = await server.inject({
      method: 'POST',
      url: `/api/v1/pages/${page.id}/revisions`,
      headers: projectHeaders,
      payload: { expectedWorkingVersion: workingState.data.workingVersion },
    });
    expect(checkpointResponse.statusCode).toBe(200);
    const saved = checkpointResponse.json() as {
      success: true;
      data: { revisionId: string; workingVersion: number };
    };
    expect(saved.data.workingVersion).toBeGreaterThan(workingState.data.workingVersion);
    expect(saved.data.revisionId).not.toBe(workingBefore.data.revisionId);
    const historyResponse = await server.inject({
      method: 'GET',
      url: `/api/v1/pages/${page.id}/revisions`,
      headers: projectHeaders,
    });
    expect(historyResponse.statusCode).toBe(200);
    expect(historyResponse.json()).toMatchObject({
      success: true,
      data: {
        revisions: [
          { revisionId: saved.data.revisionId, isCurrent: true, isApplied: false },
          { revisionId: workingBefore.data.revisionId, isCurrent: false, isApplied: true },
        ],
      },
    });
    const applyResponse = await server.inject({
      method: 'POST',
      url: `/api/v1/pages/${page.id}/apply`,
      headers: projectHeaders,
      payload: {
        expectedRevisionId: saved.data.revisionId,
        expectedWorkingVersion: saved.data.workingVersion,
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

  it('initializes a project manifest when opening an uninitialized directory', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-imported-project-'));
    directories.push(directory);
    const database = new ApplicationDatabase(join(directory, 'origamix.db'));
    const projects = new ProjectRepository(database);
    const service = new ProjectService(projects, templatePath);
    service.registerGrant('grant_existing', directory);

    const pending = await service.openProject({
      directoryGrantId: 'grant_existing',
      name: '导入项目',
      code: 'imported-project',
    });
    expect(pending.status).toBe('initialization_required');
    if (pending.status !== 'initialization_required') throw new Error('expected inspection');
    await expect(readFile(join(directory, 'origamix.project.json'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
    const opened = await service.openProject({
      directoryGrantId: 'grant_existing',
      name: '导入项目',
      code: 'imported-project',
      initializeIfNeeded: true,
    });
    if (opened.status !== 'opened') throw new Error('expected opened project');
    const project = opened.project;
    const manifest = JSON.parse(
      await readFile(join(directory, 'origamix.project.json'), 'utf8'),
    ) as { name: string; code: string };

    expect(manifest).toMatchObject({
      name: '导入项目',
      code: 'imported-project',
      pageDirectory: 'pages',
    });
    expect(project.name).toBe('导入项目');
    expect(manifest).toMatchObject({
      framework: 'react',
      uiLibrary: 'antd',
      pages: [],
    });
    await access(join(directory, 'src', 'router.ts'));
    await access(join(directory, 'vite.config.ts'));
    database.close();
  });

  it('renames and duplicates records while desktop deletion preserves project files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-lifecycle-'));
    directories.push(directory);
    const database = new ApplicationDatabase(join(directory, 'origamix.db'));
    const projects = new ProjectRepository(database);
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
    });
    const server = createHttpServer({
      desktopToken: 'desktop-token',
      serviceInstanceId: 'service-instance',
      projects,
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
      .run('conversation_lifecycle', project.id, duplicatePage.id, 'test', 0, timestamp, timestamp);
    database.connection
      .prepare(
        'INSERT INTO messages (id, conversation_id, role, content_json, status, sequence, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        'message_lifecycle',
        'conversation_lifecycle',
        'user',
        '{"version":"1","blocks":[]}',
        2,
        0,
        timestamp,
        timestamp,
      );
    database.connection
      .prepare(
        `INSERT INTO agent_runs (
          id, project_id, page_id, conversation_id, user_message_id, client_request_id,
          base_working_version, model_ref, run_kind, status, budget_json, prompt_version,
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
        1,
        'fake/model',
        'page_assistant',
        9,
        '{"maxModelCalls":1,"maxToolCalls":1,"maxOutputTokens":1,"maxDurationMs":1,"maxSchemaBytes":1,"maxRepairAttempts":0}',
        '1',
        '1',
        '1',
        '1',
        timestamp,
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
    for (const table of ['conversations', 'messages', 'agent_runs']) {
      expect(
        database.connection.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get(),
      ).toMatchObject({ count: 0 });
    }
    await expect(access(duplicatePath)).rejects.toThrow();
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
