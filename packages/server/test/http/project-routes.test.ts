import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { ApplicationDatabase } from '@/database/database';
import { ProjectRepository } from '@/projects/project-repository';
import { ProjectService } from '@/projects/project-service';
import { createHttpServer } from '@/http/server';

const directories: string[] = [];
const templatePath = fileURLToPath(new URL('../../../template', import.meta.url));

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('Project and Schema HTTP flows', () => {
  it('creates projects and pages and accepts a typed visual edit', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-project-'));
    directories.push(directory);
    const database = new ApplicationDatabase(join(directory, 'origamix.db'));
    const projects = new ProjectRepository(database);
    const service = new ProjectService(projects, templatePath);
    service.registerGrant('grant_project', directory);
    const server = createHttpServer({
      host: 'desktop',
      desktopToken: 'desktop-token',
      serviceInstanceId: 'service-instance',
      projects,
      projectService: service,
    });
    const headers = {
      authorization: 'Bearer desktop-token',
      'x-origamix-service': 'service-instance',
    };
    const createProject = await server.inject({
      method: 'POST',
      url: '/api/v1/projects/create',
      headers,
      payload: {
        name: '客户控制台',
        code: 'customer-console',
        pageDirectory: 'screens',
        directoryGrantId: 'grant_project',
      },
    });
    expect(createProject.statusCode).toBe(201);
    const project = createProject.json().data as { id: string; path: string };
    expect(project.path).toBe(join(directory, 'customer-console'));

    const createPage = await server.inject({
      method: 'POST',
      url: '/api/v1/pages/create',
      headers,
      payload: { projectId: project.id, name: '客户列表', slug: 'customer-list' },
    });
    expect(createPage.statusCode).toBe(201);
    const page = createPage.json().data as { id: string; slug: string };
    expect(page.slug).toBe('customer-list');
    expect(
      await readFile(join(project.path, 'src', 'screens', page.slug, 'index.tsx'), 'utf8'),
    ).toContain('OrigamixPage');
    const workingBeforeResponse = await server.inject({
      method: 'POST',
      url: '/api/v1/pages/working-state/get',
      headers,
      payload: { projectId: project.id, pageId: page.id },
    });
    expect(workingBeforeResponse.statusCode).toBe(200);
    const { workingVersion, schema } = workingBeforeResponse.json().data as {
      workingVersion: number;
      schema: { layout: { root: string } };
    };
    expect(schema.layout.root).toMatch(/^container_[A-Za-z0-9_-]{8}$/);
    const draftResponse = await server.inject({
      method: 'POST',
      url: '/api/v1/pages/working-operations/apply',
      headers,
      payload: {
        projectId: project.id,
        pageId: page.id,
        baseWorkingVersion: workingVersion,
        operations: [
          {
            operation: 'addElement',
            elementId: 'form_http',
            element: {
              type: 'form',
              props: { layout: 'horizontal', colon: true, preserve: true },
            },
            parentId: schema.layout.root,
          },
        ],
      },
    });
    expect(draftResponse.statusCode, draftResponse.body).toBe(200);
    expect(draftResponse.json().data).toMatchObject({
      workingVersion: workingVersion + 1,
      schema: {
        elements: {
          form_http: { type: 'form', props: { layout: 'horizontal', colon: true, preserve: true } },
        },
      },
    });
    await server.close();
    database.close();
  });

  it('removes a deleted page and its Agent records without deleting project files', async () => {
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
    const page = await service.createPage(project.id, {
      name: '首页',
      slug: 'home',
    });
    const server = createHttpServer({
      host: 'desktop',
      desktopToken: 'desktop-token',
      serviceInstanceId: 'service-instance',
      projects,
      projectService: service,
    });
    const headers = {
      authorization: 'Bearer desktop-token',
      'x-origamix-service': 'service-instance',
    };
    const pagePath = join(project.path, 'src', 'pages', page.slug, 'schema.json');
    const timestamp = new Date().toISOString();
    const projectKey = (
      database.connection
        .prepare('SELECT id FROM projects WHERE project_id = ?')
        .get(project.id) as { id: number }
    ).id;
    const pageKey = (
      database.connection.prepare('SELECT id FROM pages WHERE page_id = ?').get(page.id) as {
        id: number;
      }
    ).id;
    const conversationId = Number(
      database.connection
        .prepare(
          'INSERT INTO conversations (project_id, page_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(projectKey, pageKey, 'test', 0, timestamp, timestamp).lastInsertRowid,
    );
    const messageId = Number(
      database.connection
        .prepare(
          'INSERT INTO messages (conversation_id, role, content_json, status, sequence, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(conversationId, 'user', '{"version":"1","blocks":[]}', 2, 0, timestamp, timestamp)
        .lastInsertRowid,
    );
    database.connection
      .prepare(
        `INSERT INTO agent_runs (
          run_id, project_id, page_id, conversation_id, user_message_id, client_request_id,
          base_working_version, model_ref, run_kind, status, budget_json, prompt_version,
          policy_version, toolset_version, material_manifest_version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'run_lifecycle',
        projectKey,
        pageKey,
        conversationId,
        messageId,
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
    const runKey = (
      database.connection
        .prepare('SELECT id FROM agent_runs WHERE run_id = ?')
        .get('run_lifecycle') as { id: number }
    ).id;
    database.connection
      .prepare(
        'INSERT INTO agent_tool_audits (run_id, sequence, tool_name, phase, duration_ms, occurred_at) VALUES (?, 0, ?, ?, 0, ?)',
      )
      .run(runKey, 'complete_page_run', 'started', timestamp);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/v1/pages/delete',
          headers,
          payload: { projectId: project.id, pageId: page.id },
        })
      ).json().data,
    ).toEqual({ deleted: true });
    expect(projects.getPage(project.id, page.id)).toBeUndefined();
    for (const table of ['conversations', 'messages', 'agent_runs', 'agent_tool_audits']) {
      expect(
        database.connection.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get(),
      ).toMatchObject({ count: 0 });
    }
    await expect(access(pagePath)).rejects.toThrow();
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/v1/projects/delete',
          headers,
          payload: { projectId: project.id },
        })
      ).json().data,
    ).toEqual({ deleted: true });
    expect(projects.getProject(project.id)).toBeUndefined();
    await access(join(project.path, 'origamix.project.json'));
    await server.close();
    database.close();
  });
});
