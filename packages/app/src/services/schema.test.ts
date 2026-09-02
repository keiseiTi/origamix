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
});
