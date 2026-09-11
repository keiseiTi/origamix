import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';

const request = vi.fn();
vi.mock('./request', () => ({ request }));

const schema: OrigamixPageSchema = {
  elements: { element_root: { type: 'container', props: {} } },
  layout: { root: 'element_root', structure: { element_root: [] } },
  flows: {},
  bindElements: [],
  context: { globalVariables: [] },
  extensions: { origamix: { schemaVersion: '1.0' } },
};

describe('schema service', () => {
  beforeEach(() => request.mockReset());

  it('commits editor output as a revision-checked replaceSchema ChangeSet', async () => {
    request.mockResolvedValue({ schema, revisionId: 'revision_next' });
    const { schemaService } = await import('./schema');

    await schemaService.replace('project_one', 'page_one', {
      baseRevisionId: 'revision_base',
      schema,
    });

    expect(request).toHaveBeenCalledWith('/pages/page_one/changesets', {
      projectId: 'project_one',
      method: 'POST',
      body: expect.any(String),
    });
    const input = request.mock.calls[0]?.[1] as { body: string };
    expect(JSON.parse(input.body)).toMatchObject({
      pageId: 'page_one',
      baseRevisionId: 'revision_base',
      source: { kind: 'user' },
      operation: 'replaceSchema',
      schema,
    });
  });

  it('uses the caller-provided stable apply request ID and response validator', async () => {
    request.mockResolvedValue({
      pageId: 'page_one',
      revisionId: 'revision_next',
      schemaHash: 'a'.repeat(64),
      appliedAt: '2026-09-11T00:00:00.000Z',
      status: 'applied',
    });
    const { schemaService } = await import('./schema');

    await schemaService.apply('project_one', 'page_one', 'revision_next', 'request_stable');

    expect(request).toHaveBeenCalledWith(
      '/pages/page_one/apply',
      expect.objectContaining({
        projectId: 'project_one',
        method: 'POST',
        body: JSON.stringify({
          expectedRevisionId: 'revision_next',
          clientRequestId: 'request_stable',
        }),
      }),
      expect.any(Function),
    );
  });
});
