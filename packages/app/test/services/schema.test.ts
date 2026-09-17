import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';

const request = vi.fn();
vi.mock('../../src/services/request', () => ({ request }));

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
    const { schemaService } = await import('../../src/services/schema');

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
    const { schemaService } = await import('../../src/services/schema');

    await schemaService.apply('project_one', 'page_one', 'revision_next', 3, 'request_stable');

    expect(request).toHaveBeenCalledWith(
      '/pages/page_one/apply',
      expect.objectContaining({
        projectId: 'project_one',
        method: 'POST',
        body: JSON.stringify({
          expectedRevisionId: 'revision_next',
          expectedWorkingVersion: 3,
          clientRequestId: 'request_stable',
        }),
      }),
      expect.any(Function),
    );
  });

  it('reads Working state and sends explicit save/restore version requests', async () => {
    request.mockResolvedValue({
      schema,
      revisionId: 'revision_saved',
      workingVersion: 4,
      workingHash: 'a'.repeat(64),
      savedSchemaHash: 'b'.repeat(64),
      baselineHash: 'c'.repeat(64),
    });
    const { schemaService } = await import('../../src/services/schema');

    await schemaService.workingState('project_one', 'page_one');
    await schemaService.updateWorking('project_one', 'page_one', 3, schema);
    await schemaService.saveRevision('project_one', 'page_one', 4);
    await schemaService.restoreRevision('project_one', 'page_one', 'revision_old', 5);

    expect(request).toHaveBeenNthCalledWith(1, '/pages/page_one/working-state', {
      projectId: 'project_one',
    });
    expect(request).toHaveBeenNthCalledWith(2, '/pages/page_one/working-state', {
      projectId: 'project_one',
      method: 'PUT',
      body: JSON.stringify({ baseWorkingVersion: 3, schema }),
    });
    expect(request).toHaveBeenNthCalledWith(3, '/pages/page_one/revisions', {
      projectId: 'project_one',
      method: 'POST',
      body: JSON.stringify({ expectedWorkingVersion: 4 }),
    });
    expect(request).toHaveBeenNthCalledWith(4, '/pages/page_one/revisions/revision_old/restore', {
      projectId: 'project_one',
      method: 'POST',
      body: JSON.stringify({ expectedWorkingVersion: 5 }),
    });
  });
});
