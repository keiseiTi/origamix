import { describe, expect, it } from 'vitest';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import { ProductDocsProvider } from '../services/product-docs-provider';
import type { RuntimeDiagnosticService } from '../services/runtime-diagnostic-service';
import { createDomainAgentTools } from './domain-tools';

const schema: OrigamixPageSchema = {
  elements: { element_root: { type: 'container', props: {} } },
  layout: { root: 'element_root', structure: { element_root: [] } },
  flows: {},
  bindElements: [],
  context: { globalVariables: [] },
  extensions: { origamix: { schemaVersion: '1.0' } },
};

const tools = (maxResultBytes?: number) => {
  const diagnostics = {
    getState: async () => ({
      version: '1',
      projectId: 'project_test',
      pageId: 'page_test',
      currentRevisionId: 'revision_test',
      diagnostics: [],
    }),
  } as unknown as RuntimeDiagnosticService;
  return createDomainAgentTools(
    { projectId: 'project_test', pageId: 'page_test' },
    {
      projects: {
        getProject: (id) => (id === 'project_test' ? ({ id } as never) : undefined),
        getPage: (projectId, pageId) =>
          projectId === 'project_test' && pageId === 'page_test'
            ? ({ id: pageId } as never)
            : undefined,
      },
      docs: new ProductDocsProvider(),
      diagnostics,
      maxResultBytes,
    },
  );
};

describe('documentation, validation and diagnostic tools', () => {
  it('returns safe product documentation and no result for an unknown query', async () => {
    const [search] = tools();
    const signal = new AbortController().signal;
    const found = (await search!.execute(
      { projectId: 'project_test', pageId: 'page_test', query: '表单搭建器' },
      signal,
    )) as Array<{ trust: string }>;
    expect(found[0]?.trust).toBe('untrusted_reference');
    await expect(
      search!.execute({ projectId: 'project_other', pageId: 'page_test', query: '表单' }, signal),
    ).rejects.toThrow('不属于');
  });

  it('preflights malformed and material-invalid candidates without committing', async () => {
    const validate = tools()[1]!;
    const malformed = (await validate.execute(
      { projectId: 'project_test', pageId: 'page_test', schema: {} },
      new AbortController().signal,
    )) as { valid: boolean; errors: Array<{ code: string }> };
    expect(malformed.valid).toBe(false);
    expect(malformed.errors[0]?.code).toBe('INVALID_PAGE_SCHEMA');
    const candidate = structuredClone(schema);
    candidate.elements.element_root!.type = 'unknown';
    const invalid = (await validate.execute(
      { projectId: 'project_test', pageId: 'page_test', schema: candidate },
      new AbortController().signal,
    )) as { valid: boolean; errors: Array<{ code: string }> };
    expect(invalid.errors.some((entry) => entry.code === 'UNKNOWN_MATERIAL')).toBe(true);
  });

  it('returns bounded diagnostics owned by the current page', async () => {
    const diagnostics = tools(80)[2]!;
    const result = await diagnostics.execute(
      { projectId: 'project_test', pageId: 'page_test' },
      new AbortController().signal,
    );
    expect(result).toMatchObject({ truncated: true });
  });
});
