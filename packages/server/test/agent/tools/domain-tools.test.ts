import { createProjectStackFixture } from '../../fixtures/project-stack-fixture';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { ProductDocsProvider } from '@/agent/product-docs-provider';
import type { RuntimeDiagnosticService } from '@/diagnostics/diagnostic-service';
import { createDomainAgentTools } from '@/agent/tools/domain-tools';

let projectFixture: Awaited<ReturnType<typeof createProjectStackFixture>>;
beforeAll(async () => {
  projectFixture = await createProjectStackFixture();
});
afterAll(async () => {
  await projectFixture.close();
});

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
  it('returns bounded diagnostics owned by the current page', async () => {
    const diagnostics = tools(80)[1]!;
    const result = await diagnostics.execute({}, new AbortController().signal);
    expect(result).toMatchObject({ truncated: true });
  });
});
