import { ORIGAMIX_VERSION } from '@origamix/shared';
import { createProjectStackFixture } from '../../fixtures/project-stack-fixture';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { OrigamixPageSchema } from '@origamix/shared';
import { ProductDocsProvider } from '../../../src/agent/product-docs-provider';
import type { RuntimeDiagnosticService } from '../../../src/diagnostics/diagnostic-service';
import { createDomainAgentTools } from '../../../src/agent/tools/domain-tools';

let projectFixture: Awaited<ReturnType<typeof createProjectStackFixture>>;
beforeAll(async () => {
  projectFixture = await createProjectStackFixture();
});
afterAll(async () => {
  await projectFixture.close();
});

const schema: OrigamixPageSchema = {
  elements: { element_root: { type: 'container', props: {} } },
  layout: { root: 'element_root', structure: { element_root: [] } },
  flows: {},
  bindElements: [],
  context: { globalVariables: [] },
  extensions: { origamix: { schemaVersion: ORIGAMIX_VERSION } },
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
        getProject: (id) =>
          id === 'project_test' ? ({ id, path: projectFixture.path } as never) : undefined,
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
  it('preflights malformed and material-invalid candidates without committing', async () => {
    const validate = tools()[1]!;
    const malformed = (await validate.execute({ schema: {} }, new AbortController().signal)) as {
      valid: boolean;
      errors: Array<{ code: string }>;
    };
    expect(malformed.valid).toBe(false);
    expect(malformed.errors[0]?.code).toBe('INVALID_PAGE_SCHEMA');
    const candidate = structuredClone(schema);
    candidate.elements.element_root!.type = 'unknown';
    const invalid = (await validate.execute(
      { schema: candidate },
      new AbortController().signal,
    )) as { valid: boolean; errors: Array<{ code: string }> };
    expect(invalid.errors.some((entry) => entry.code === 'UNKNOWN_MATERIAL')).toBe(true);
  });

  it('returns bounded diagnostics owned by the current page', async () => {
    const diagnostics = tools(80)[2]!;
    const result = await diagnostics.execute({}, new AbortController().signal);
    expect(result).toMatchObject({ truncated: true });
  });
});
