// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePendingOperations } from '../../../src/store/pending-operations';

const mocks = vi.hoisted(() => ({
  listConversations: vi.fn(),
  listAllMessages: vi.fn(),
  getAgentRun: vi.fn(),
  createAgentRun: vi.fn(),
  cancelAgentRun: vi.fn(),
  subscribeAgentEvents: vi.fn(),
  applyState: vi.fn(),
  workingState: vi.fn(),
  saveRevision: vi.fn(),
  apply: vi.fn(),
  reloadFromProject: vi.fn(),
  listRevisions: vi.fn(),
  getRevision: vi.fn(),
  restoreRevision: vi.fn(),
}));
vi.mock('../../../src/services/agent', () => mocks);
vi.mock('../../../src/services/schema', () => ({ schemaService: mocks }));
vi.mock('../../../src/components/editor', () => ({
  Editor: ({ readOnly, readOnlyMessage }: { readOnly: boolean; readOnlyMessage?: string }) => (
    <button disabled={readOnly} aria-label='编辑画布'>
      {readOnlyMessage ?? '画布'}
    </button>
  ),
}));
import { Workspace } from '../../../src/components/workspace';

const props = {
  projectId: 'project_1',
  page: { id: 'page_a', name: 'Page', fileName: 'page' },
  mode: 'chat' as const,
  theme: 'light' as const,
  onCreateProject: vi.fn(),
  editorRef: { current: null },
  onModeChange: vi.fn(),
  onPreview: vi.fn(),
  draft: 'hello',
  onDraftChange: vi.fn(),
  supportsNativeProjectDirectories: false,
  schemaRefreshKey: '',
  onSchemaCommitted: vi.fn(),
};
describe('workspace recovery controls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    usePendingOperations.setState({ applies: {}, agents: {} });
    mocks.applyState.mockResolvedValue({ status: 'saved_pending_apply' });
    mocks.workingState.mockResolvedValue({ revisionId: 'revision_1', workingVersion: 2 });
    mocks.listConversations.mockRejectedValue(new Error('无法恢复对话'));
    mocks.listRevisions.mockResolvedValue({
      revisions: [
        {
          revisionId: 'revision_1',
          parentRevisionId: null,
          source: { kind: 'user' },
          createdAt: '2026-09-17T00:00:00.000Z',
          schemaHash: 'a'.repeat(64),
          isCurrent: true,
          isApplied: false,
        },
      ],
    });
  });
  afterEach(cleanup);

  it('keeps retained tab sessions mounted while only the active tab handles shortcuts', async () => {
    mocks.listConversations.mockResolvedValue({ conversations: [] });
    mocks.applyState.mockResolvedValue({ status: 'draft_unsaved' });
    mocks.saveRevision.mockResolvedValue({ revisionId: 'revision_2', workingVersion: 3 });
    const second = {
      ...props,
      active: false,
      page: { id: 'page_b', name: 'Second', fileName: 'second' },
      editorRef: { current: null },
    };
    const view = render(
      <>
        <Workspace {...props} active />
        <Workspace {...second} />
      </>,
    );
    await waitFor(() => {
      const buttons = screen.getAllByRole('button', { name: '保存版本' });
      expect(buttons).toHaveLength(2);
      expect((buttons[0] as HTMLButtonElement).disabled).toBe(false);
      expect((buttons[1] as HTMLButtonElement).disabled).toBe(true);
    });

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(mocks.saveRevision).toHaveBeenCalledWith('project_1', 'page_a', 2));
    expect(mocks.saveRevision).not.toHaveBeenCalledWith('project_1', 'page_b', 2);

    view.rerender(
      <>
        <Workspace {...props} active={false} />
        <Workspace {...second} active />
      </>,
    );
    await waitFor(() => {
      const buttons = screen.getAllByRole('button', { name: '保存版本' });
      expect((buttons[1] as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(mocks.saveRevision).toHaveBeenCalledWith('project_1', 'page_b', 2));
    expect(mocks.listConversations).toHaveBeenCalledTimes(2);
  });
});
