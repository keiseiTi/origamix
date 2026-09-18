import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import { ApplicationDatabase } from '../../../database/database';
import { AgentRunRepository, type AgentRunRecord } from '../../../agent/run-repository';
import { ProjectRepository } from '../../../projects/project-repository';
import {
  getSchema,
  getWorkingSchemaState,
  initializePageSchema,
} from '../../../schema/schema-service';
import { createApplyPageOperationsTool } from '../../../agent/tools/apply-page-operations';

const directories: string[] = [];
const pageSchema = (type = 'container'): OrigamixPageSchema => ({
  elements: { element_root: { type, props: type === 'container' ? {} : {} } },
  layout: { root: 'element_root', structure: { element_root: [] } },
  flows: {},
  bindElements: [],
  context: { globalVariables: [] },
  extensions: { origamix: { schemaVersion: '1.0' } },
});

afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true })));
});

const setup = async () => {
  const projectPath = await mkdtemp(join(tmpdir(), 'origamix-replace-tool-'));
  directories.push(projectPath);
  await mkdir(join(projectPath, 'src', 'pages', 'home'), { recursive: true });
  await writeFile(
    join(projectPath, 'src', 'pages', 'home', 'schema.json'),
    JSON.stringify(pageSchema()),
  );
  await writeFile(
    join(projectPath, 'origamix.project.json'),
    JSON.stringify({
      projectId: 'project_home',
      name: 'Home',
      framework: 'react',
      uiLibrary: 'antd',
      pages: [{ pageId: 'page_home', name: 'Home', slug: 'home' }],
    }),
  );
  const pageRef = { projectPath, pageId: 'page_home', slug: 'home' };
  const initialRevisionId = await initializePageSchema(pageRef, pageSchema());
  const database = new ApplicationDatabase(':memory:');
  const timestamp = new Date().toISOString();
  database.connection
    .prepare(
      'INSERT INTO projects (id, path, name, status, created_at, last_opened_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run('project_test', projectPath, 'Test', 0, timestamp, timestamp);
  database.connection
    .prepare(
      'INSERT INTO pages (id, project_id, slug, name, relative_path, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run('page_home', 'project_test', 'home', 'Home', 'pages/home', 0, timestamp, timestamp);
  const runs = new AgentRunRepository(database);
  const run: AgentRunRecord = {
    id: 'run_replace',
    projectId: 'project_test',
    pageId: 'page_home',
    conversationId: 'conversation_test',
    userMessageId: 'message_test',
    clientRequestId: 'request_test',
    baseWorkingVersion: 1,
    modelRef: 'deepseek/deepseek-v4-flash',
    mode: 'page_modify',
    status: 'tool_calling',
    budget: {
      maxModelCalls: 1,
      maxToolCalls: 1,
      maxOutputTokens: 100,
      maxDurationMs: 10_000,
      maxSchemaBytes: 10_000,
      maxRepairAttempts: 1,
    },
    promptVersion: '1',
    policyVersion: '1',
    toolsetVersion: '1',
    materialManifestVersion: 'official-antd@1.0.0',
    inputTokens: 0,
    outputTokens: 0,
    modelCalls: 0,
    toolCalls: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  runs.create(run);
  const projects = new ProjectRepository(database);
  const tool = createApplyPageOperationsTool(
    { projects, runs },
    {
      runId: run.id,
      messageId: run.userMessageId,
      projectId: run.projectId,
      pageId: run.pageId,
      baseWorkingVersion: run.baseWorkingVersion,
      maxSchemaBytes: run.budget.maxSchemaBytes,
    },
  );
  return { database, pageRef, initialRevisionId, runs, tool };
};

describe('apply_page_operations tool', () => {
  it('updates Working atomically without creating a Revision', async () => {
    const fixture = await setup();
    const before = await readdir(
      join(fixture.pageRef.projectPath, '.origamix', 'revisions', 'page_home'),
    );
    const result = (await fixture.tool.execute(
      {
        operations: [
          {
            operation: 'addElement',
            elementId: 'text_title',
            element: { type: 'text', props: { text: 'Title' } },
            parentId: 'element_root',
          },
        ],
      },
      new AbortController().signal,
    )) as { workingVersion: number };
    expect(result.workingVersion).toBe(2);
    expect((await getWorkingSchemaState(fixture.pageRef)).schema.elements.text_title).toBeDefined();
    expect(
      await readdir(join(fixture.pageRef.projectPath, '.origamix', 'revisions', 'page_home')),
    ).toEqual(before);
    fixture.database.close();
  });

  it('rejects invalid materials without creating a revision', async () => {
    const fixture = await setup();
    const before = await readdir(
      join(fixture.pageRef.projectPath, '.origamix', 'revisions', 'page_home'),
    );
    await expect(
      fixture.tool.execute(
        {
          operations: [
            {
              operation: 'replaceElement',
              elementId: 'element_root',
              element: { type: 'unknown', props: {} },
            },
          ],
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow('UNKNOWN_MATERIAL');
    const after = await readdir(
      join(fixture.pageRef.projectPath, '.origamix', 'revisions', 'page_home'),
    );
    expect(after).toEqual(before);
    expect((await getSchema(fixture.pageRef)).revisionId).toBe(fixture.initialRevisionId);
    fixture.database.close();
  });

  it('rejects forged ownership, oversized schemas and cancellation before commit', async () => {
    const fixture = await setup();
    const controller = new AbortController();
    controller.abort();
    await expect(
      fixture.tool.execute(
        {
          operations: [{ operation: 'updateElementProps', elementId: 'element_root', set: {} }],
        },
        controller.signal,
      ),
    ).rejects.toMatchObject({
      code: 'CANCELLED',
    });
    const wrong = createApplyPageOperationsTool(
      { projects: new ProjectRepository(fixture.database), runs: fixture.runs },
      {
        runId: 'run_replace',
        messageId: 'message_forged',
        projectId: 'project_test',
        pageId: 'page_home',
        baseWorkingVersion: 1,
        maxSchemaBytes: 1,
      },
    );
    await expect(
      wrong.execute(
        {
          operations: [{ operation: 'updateElementProps', elementId: 'element_root', set: {} }],
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow('无权');
    fixture.database.close();
  });

  it('lets an already committed result win over a later cancellation', async () => {
    const fixture = await setup();
    const controller = new AbortController();
    const result = (await fixture.tool.execute(
      {
        operations: [
          { operation: 'updateElementProps', elementId: 'element_root', set: { padding: 8 } },
        ],
      },
      controller.signal,
    )) as { workingVersion: number };
    controller.abort();
    expect((await getWorkingSchemaState(fixture.pageRef)).workingVersion).toBe(
      result.workingVersion,
    );
    expect((await getSchema(fixture.pageRef)).revisionId).toBe(fixture.initialRevisionId);
    fixture.database.close();
  });
});
