import { loadProjectMaterials } from '../../../projects/project-materials';
import { createProjectStackFixture } from '../../../testing/project-stack-fixture';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { getFlowNodeManifest, type OrigamixPageSchema } from '@origamix/shared';
import { ApiError } from '../../../errors';
import { createReadOnlyAgentTools } from '../../../agent/tools/read-only-tools';

let projectFixture: Awaited<ReturnType<typeof createProjectStackFixture>>;
beforeAll(async () => {
  projectFixture = await createProjectStackFixture();
});
afterAll(async () => {
  await projectFixture.close();
});

const revisionId = 'revision_current';
const schema: OrigamixPageSchema = {
  elements: {
    element_root: { type: 'container', props: { padding: 16 } },
    'form-main': { type: 'form', props: { layout: 'vertical', alias: '报名表单' } },
    'input-name': { type: 'input', props: { placeholder: '姓名' } },
  },
  layout: {
    root: 'element_root',
    structure: {
      element_root: ['form-main'],
      'form-main': ['input-name'],
      'input-name': [],
    },
  },
  flows: {},
  bindElements: [],
  context: { globalVariables: [] },
  extensions: { origamix: { schemaVersion: '1.0' } },
};

const setup = (readSchema = vi.fn(async () => ({ schema, revisionId, workingVersion: 1 }))) => {
  const projects = {
    getProject: vi.fn((id: string) =>
      id === 'project_one'
        ? {
            id,
            path: projectFixture.path,
            name: 'Project',
            status: 0,
            createdAt: '2026-01-01T00:00:00.000Z',
            lastOpenedAt: '2026-01-01T00:00:00.000Z',
          }
        : undefined,
    ),
    getPage: vi.fn((projectId: string, pageId: string) =>
      projectId === 'project_one' && pageId === 'page_one'
        ? {
            id: pageId,
            projectId,
            slug: 'home',
            name: '首页',
            relativePath: 'src/pages/home',
            status: 0,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          }
        : undefined,
    ),
  };
  const tools = createReadOnlyAgentTools(
    {
      runId: 'run_one',
      projectId: 'project_one',
      pageId: 'page_one',
      workingVersion: 1,
    },
    { projects, readSchema, loadMaterials: loadProjectMaterials },
  );
  const execute = (name: string, input: unknown) => {
    const tool = tools.find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`missing tool ${name}`);
    return tool.execute(input, new AbortController().signal);
  };
  return { execute, projects, readSchema, tools };
};

const scope = {};

describe('read-only Agent tools', () => {
  it('reads exact flow code, shared bindings, variables and node schemas without compacting nested data', async () => {
    const draft = structuredClone(schema);
    const body = `return ${JSON.stringify('保留原始代码\n"\\'.repeat(300))};`;
    draft.flows.flow_shared = {
      startId: 'start',
      nodes: {
        start: { id: 'start', type: 'start', props: {}, prev: [], next: ['script'] },
        script: {
          id: 'script',
          type: 'customJS',
          props: { value: { type: 'function', value: { params: [], body } } },
          prev: ['start'],
          next: [],
        },
      },
    };
    draft.bindElements = [
      { id: 'form-main', event: 'init', flowId: 'flow_shared' },
      { id: 'input-name', event: 'init', flowId: 'flow_shared' },
    ];
    draft.context.globalVariables = [{ name: 'payload', type: 'string', defaultValue: body }];
    const { execute } = setup(
      vi.fn(async () => ({ schema: draft, revisionId, workingVersion: 1 })),
    );
    const readAll = async (name: string, selector: Record<string, unknown>) => {
      let json = '';
      let offset = 0;
      while (true) {
        const result = (await execute(name, { ...selector, offset, maxChars: 1024 })) as {
          complete: boolean;
          data?: unknown;
          json?: string;
          offset: number;
          totalChars: number;
          nextOffset: number | null;
          workingVersion: number;
        };
        expect(result.workingVersion).toBe(1);
        expect(Buffer.byteLength(JSON.stringify(result), 'utf8')).toBeLessThanOrEqual(24 * 1024);
        if (result.complete) return result.data;
        expect(result.offset).toBe(offset);
        json += result.json;
        if (result.nextOffset === null) {
          expect(json.length).toBe(result.totalChars);
          return JSON.parse(json) as unknown;
        }
        expect(result.nextOffset).toBeGreaterThan(offset);
        offset = result.nextOffset;
      }
    };
    expect(await readAll('get_event_flow', { elementId: 'form-main', event: 'init' })).toEqual({
      flowId: 'flow_shared',
      flow: draft.flows.flow_shared,
      bindings: draft.bindElements,
    });
    expect(await readAll('get_page_logic_context', {})).toMatchObject({
      bindings: draft.bindElements,
      globalVariables: draft.context.globalVariables,
    });
    expect(await readAll('get_flow_node_manifest', { type: 'interfaceRequest' })).toEqual({
      formatVersion: '1.0',
      manifest: JSON.parse(JSON.stringify(getFlowNodeManifest('interfaceRequest'))),
    });
    const material = (await readAll('get_material_manifest', { type: 'datePicker' })) as {
      manifest: { propsSchema: unknown };
    };
    expect(material.manifest.propsSchema).toMatchObject({
      properties: { showTime: { type: 'boolean' } },
    });
  });

  it('keeps logic reads scoped to the Run page and starting Working version', async () => {
    const { execute, tools } = setup();
    await expect(execute('get_event_flow', { flowId: 'foreign' })).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(
      execute('get_event_flow', { elementId: 'foreign', event: 'init' }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      execute('get_event_flow', { elementId: 'form-main', event: 'unknown' }),
    ).rejects.toMatchObject({ statusCode: 422 });
    await expect(execute('get_page_logic_context', { pageId: 'foreign' })).rejects.toMatchObject({
      statusCode: 422,
    });
    const stale = setup(vi.fn(async () => ({ schema, revisionId, workingVersion: 2 })));
    await expect(
      stale.execute('get_flow_node_manifest', { type: 'customJS' }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      tools
        .find((tool) => tool.name === 'get_page_logic_context')!
        .execute({}, AbortSignal.abort()),
    ).rejects.toThrow();
  });
  it('loads one revision once per Run and returns compact page context and outline', async () => {
    const { execute, readSchema } = setup();
    await expect(execute('get_page_context', scope)).resolves.toMatchObject({
      revisionId,
      elementCount: 3,
      page: { id: 'page_one', slug: 'home' },
      materialSet: { id: 'official-antd', version: '1.0.0' },
    });
    await expect(execute('get_schema_outline', scope)).resolves.toMatchObject({
      revisionId,
      totalElements: 3,
      nodes: [
        { id: 'element_root', label: 'element_root（容器）', type: 'container', depth: 0 },
        { id: 'form-main', label: '报名表单', type: 'form', depth: 1 },
        { id: 'input-name', label: 'input-name（输入框）', type: 'input', depth: 2 },
      ],
    });
    await execute('get_page_context', scope);
    expect(readSchema).toHaveBeenCalledTimes(1);
    expect(readSchema).toHaveBeenCalledWith({
      projectPath: projectFixture.path,
      pageId: 'page_one',
      slug: 'home',
      relativePath: 'src/pages/home',
    });
  });

  it('rejects extra input and stale revisions before exposing content', async () => {
    const current = setup();
    await expect(
      current.execute('get_page_context', { ...scope, unexpected: true }),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(current.readSchema).not.toHaveBeenCalled();

    const stale = setup(
      vi.fn(async () => ({ schema, revisionId: 'revision_new', workingVersion: 2 })),
    );
    await expect(stale.execute('get_page_context', scope)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('returns only the requested page fragment and rejects unknown element ownership', async () => {
    const { execute } = setup();
    await expect(
      execute('get_schema_fragment', { elementId: 'form-main', depth: 0 }),
    ).resolves.toMatchObject({
      requestedElementId: 'form-main',
      elements: [{ id: 'form-main', type: 'form', childIds: ['input-name'] }],
    });
    await expect(
      execute('get_schema_fragment', { elementId: 'element_foreign' }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('searches compact material summaries and reads manifests only by an exact known type', async () => {
    const { execute } = setup();
    await expect(execute('search_materials', { query: '表单' })).resolves.toMatchObject({
      matches: expect.arrayContaining([expect.objectContaining({ type: 'form' })]),
    });
    await expect(execute('get_material_manifest', { type: 'input' })).resolves.toMatchObject({
      data: { manifest: { type: 'input', version: '1.0.0' } },
    });
    await expect(execute('get_material_manifest', { type: 'unknown' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
