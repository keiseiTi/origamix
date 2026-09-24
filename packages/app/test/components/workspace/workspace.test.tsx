// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePendingOperations } from '../../../src/store/pending-operations';
import { useWorkspaceStore } from '../../../src/store/workspace';

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
  editorMounted: vi.fn(),
}));
vi.mock('../../../src/services/agent', () => mocks);
vi.mock('../../../src/services/schema', () => ({ schemaService: mocks }));
vi.mock('../../../src/components/editor', () => ({
  Editor: ({ readOnly, readOnlyMessage }: { readOnly: boolean; readOnlyMessage?: string }) => {
    useEffect(() => mocks.editorMounted(), []);
    return (
      <button disabled={readOnly} aria-label='编辑画布'>
        {readOnlyMessage ?? '画布'}
      </button>
    );
  },
}));
import { Workspace } from '../../../src/components/workspace';

const props = {
  pageId: 'page_a',
  onCreateProject: vi.fn(),
  editorRef: { current: null },
  onModeChange: vi.fn(),
  onPreview: vi.fn(),
  schemaRefreshKey: '',
  onSchemaCommitted: vi.fn(),
};
describe('workspace recovery controls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    usePendingOperations.setState({ applies: {}, agents: {} });
    useWorkspaceStore.setState({
      projects: [
        {
          id: 'project_1',
          name: 'Project',
          path: '/project',
          pages: [
            { id: 'page_a', name: 'Page', fileName: 'page' },
            { id: 'page_b', name: 'Second', fileName: 'second' },
          ],
        },
      ],
      openPages: [
        {
          id: 'page_a',
          projectId: 'project_1',
          name: 'Page',
          fileName: 'page',
          mode: 'chat',
          status: null,
        },
        {
          id: 'page_b',
          projectId: 'project_1',
          name: 'Second',
          fileName: 'second',
          mode: 'chat',
          status: null,
        },
      ],
      pageDrafts: { page_a: 'hello', page_b: '' },
    });
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
      pageId: 'page_b',
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

  it('reloads the editor directly when an Agent commits a newer Working version', async () => {
    mocks.listConversations.mockResolvedValue({
      conversations: [{ conversationId: 'conversation_1' }],
    });
    mocks.listAllMessages.mockResolvedValue({
      messages: [
        {
          runId: 'run_1',
          sequence: 1,
          role: 'user',
          content: { version: '1', blocks: [{ type: 'text', text: '重置页面' }] },
        },
      ],
    });
    mocks.getAgentRun.mockResolvedValue({
      run: { runId: 'run_1', pageId: 'page_a', status: 'reasoning' },
    });
    let listener: { onEvent: (event: unknown) => void } | undefined;
    mocks.subscribeAgentEvents.mockImplementation(
      (_projectId: string, _runId: string, next: { onEvent: (event: unknown) => void }) => {
        listener = next;
        return () => undefined;
      },
    );

    render(<Workspace {...props} active />);
    await waitFor(() => expect(listener).toBeDefined());
    expect(mocks.editorMounted).toHaveBeenCalledTimes(1);

    listener!.onEvent({
      version: '1',
      eventId: 1,
      sequence: 1,
      type: 'working.committed',
      runId: 'run_1',
      pageId: 'page_a',
      requestId: 'request_1',
      occurredAt: '2026-09-23T00:00:00.000Z',
      payload: { baseWorkingVersion: 2, resultWorkingVersion: 3, operationCount: 1 },
    });

    await waitFor(() => expect(mocks.editorMounted).toHaveBeenCalledTimes(2));
  });
});
