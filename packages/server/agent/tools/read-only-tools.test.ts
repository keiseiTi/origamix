import { describe, expect, it, vi } from 'vitest';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import { ApiError } from '../../errors';
import { createReadOnlyAgentTools } from './read-only-tools';

const revisionId = 'revision_current';
const schema: OrigamixPageSchema = {
  elements: {
    element_root: { type: 'container', props: { padding: 16 } },
    'form-main': { type: 'form', props: { layout: 'vertical' } },
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

const setup = (readSchema = vi.fn(async () => ({ schema, revisionId }))) => {
  const projects = {
    getProject: vi.fn((id: string) =>
      id === 'project_one'
        ? {
            id,
            path: '/authorized/project',
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
      revisionId,
    },
    { projects, readSchema },
  );
  const execute = (name: string, input: unknown) => {
    const tool = tools.find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`missing tool ${name}`);
    return tool.execute(input, new AbortController().signal);
  };
  return { execute, projects, readSchema, tools };
};

const scope = { projectId: 'project_one', pageId: 'page_one', revisionId };

describe('read-only Agent tools', () => {
  it('publishes only the five bounded read tools', () => {
    expect(setup().tools.map(({ name }) => name)).toEqual([
      'get_page_context',
      'get_schema_outline',
      'get_schema_fragment',
      'search_materials',
      'get_material_manifest',
    ]);
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
        { id: 'element_root', type: 'container', depth: 0 },
        { id: 'form-main', type: 'form', depth: 1 },
        { id: 'input-name', type: 'input', depth: 2 },
      ],
    });
    await execute('get_page_context', scope);
    expect(readSchema).toHaveBeenCalledTimes(1);
    expect(readSchema).toHaveBeenCalledWith({
      projectPath: '/authorized/project',
      pageId: 'page_one',
      slug: 'home',
    });
  });

  it('rejects scope changes, extra input and stale revisions before exposing content', async () => {
    const current = setup();
    await expect(
      current.execute('get_page_context', { ...scope, projectId: 'project_other' }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      current.execute('get_page_context', { ...scope, unexpected: true }),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(current.readSchema).not.toHaveBeenCalled();

    const stale = setup(vi.fn(async () => ({ schema, revisionId: 'revision_new' })));
    await expect(stale.execute('get_page_context', scope)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('returns only the requested page fragment and rejects unknown element ownership', async () => {
    const { execute } = setup();
    await expect(
      execute('get_schema_fragment', { ...scope, elementId: 'form-main', depth: 0 }),
    ).resolves.toMatchObject({
      requestedElementId: 'form-main',
      elements: [{ id: 'form-main', type: 'form', childIds: ['input-name'] }],
    });
    await expect(
      execute('get_schema_fragment', { ...scope, elementId: 'element_foreign' }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('searches compact material summaries and reads manifests only by an exact known type', async () => {
    const { execute } = setup();
    await expect(execute('search_materials', { ...scope, query: '表单' })).resolves.toMatchObject({
      matches: expect.arrayContaining([expect.objectContaining({ type: 'form' })]),
    });
    await expect(
      execute('get_material_manifest', { ...scope, type: 'input' }),
    ).resolves.toMatchObject({ manifest: { type: 'input', version: '1.0.0' } });
    await expect(
      execute('get_material_manifest', { ...scope, type: 'unknown' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('honors an already-aborted Run signal', async () => {
    const { tools } = setup();
    const controller = new AbortController();
    controller.abort(new Error('cancelled'));
    await expect(tools[0]!.execute(scope, controller.signal)).rejects.toThrow('cancelled');
  });
});
