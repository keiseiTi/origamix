// @vitest-environment happy-dom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import type { Schema } from '@tangramino/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const schemaMocks = vi.hoisted(() => ({
  workingState: vi.fn(),
  updateWorking: vi.fn(),
  applyWorkingOperations: vi.fn(),
}));

vi.mock('../../../src/services/schema', () => ({ schemaService: schemaMocks }));

import { useEditorSession } from '../../../src/components/editor/use-editor-session';

const schema: OrigamixPageSchema = {
  elements: { element_root: { type: 'container', props: {} } },
  layout: { root: 'element_root', structure: { element_root: [] } },
  flows: {},
  bindElements: [],
  context: { globalVariables: [] },
  extensions: { origamix: { schemaVersion: '1.0' } },
};

describe('useEditorSession', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    schemaMocks.workingState.mockResolvedValue({
      schema,
      revisionId: 'revision_saved',
      workingVersion: 4,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('retains visual edits in Working without creating a Revision', async () => {
    const next = structuredClone(schema);
    next.elements.element_root!.props = { padding: 24 };
    schemaMocks.applyWorkingOperations.mockResolvedValue({
      schema: next,
      revisionId: 'revision_saved',
      workingVersion: 5,
    });
    const onWorkingCommitted = vi.fn();
    const hook = renderHook(() =>
      useEditorSession('project_one', 'page_one', false, onWorkingCommitted),
    );
    await act(async () => Promise.resolve());
    await waitFor(() => expect(hook.result.current.initial).not.toBeNull());
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)));

    act(() => hook.result.current.onChange(next as Schema));
    expect(onWorkingCommitted).not.toHaveBeenCalled();
    await act(async () => hook.result.current.flush());

    expect(schemaMocks.applyWorkingOperations).toHaveBeenCalledWith('project_one', 'page_one', 4, [
      { operation: 'updateElementProps', elementId: 'element_root', set: { padding: 24 } },
    ]);
    expect(schemaMocks.updateWorking).not.toHaveBeenCalled();
    expect(hook.result.current.initial?.revisionId).toBe('revision_saved');
    expect(onWorkingCommitted).toHaveBeenCalledTimes(1);
  });
});
