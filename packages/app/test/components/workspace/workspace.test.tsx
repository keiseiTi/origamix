// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
const disabled = (name: string) =>
  (screen.getByRole('button', { name, hidden: true }) as HTMLButtonElement).disabled;

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

  it.each(['light', 'dark'])(
    'keeps mutation controls locked on recovery failure and enables them after retry (%s)',
    async (theme) => {
      render(
        <div className={theme} data-theme={theme}>
          <Workspace {...props} />
        </div>,
      );
      expect(disabled('编辑画布')).toBe(true);
      expect(disabled('发送')).toBe(true);
      await screen.findByText('无法恢复对话');
      expect(disabled('应用到项目')).toBe(true);
      mocks.listConversations.mockResolvedValue({ conversations: [] });
      fireEvent.click(screen.getByRole('button', { name: '重试' }));
      await waitFor(() => expect(disabled('编辑画布')).toBe(false));
      expect(disabled('发送')).toBe(false);
      expect(disabled('应用到项目')).toBe(false);
    },
  );

  it('exposes an explicit Apply retry after leaving and returning to the workspace', async () => {
    mocks.listConversations.mockResolvedValue({ conversations: [] });
    mocks.apply.mockRejectedValueOnce(new Error('连接中断')).mockResolvedValueOnce({});
    const first = render(<Workspace {...props} />);
    await waitFor(() => expect(disabled('应用到项目')).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: '应用到项目' }));
    await screen.findByText('连接中断');
    first.unmount();
    render(<Workspace {...props} />);
    await waitFor(() => expect(disabled('重试应用')).toBe(false));
    expect(mocks.apply).toHaveBeenCalledTimes(1);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '重试应用' })));
    await waitFor(() => expect(mocks.apply).toHaveBeenCalledTimes(2));
    expect(mocks.apply.mock.calls[1]![4]).toBe(mocks.apply.mock.calls[0]![4]);
  });

  it.each(['light', 'dark'])('opens the Revision history in %s mode', async (theme) => {
    mocks.listConversations.mockResolvedValue({ conversations: [] });
    render(
      <div className={theme} data-theme={theme}>
        <Workspace {...props} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: '版本历史' }));
    await screen.findByRole('heading', { name: '版本历史' });
    expect(await screen.findByText('最近保存')).toBeTruthy();
    expect(screen.getByRole('button', { name: '查看' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '恢复' })).toBeTruthy();
  });

  it('uses Cmd/Ctrl+S to save a retained draft as a Revision', async () => {
    mocks.listConversations.mockResolvedValue({ conversations: [] });
    mocks.applyState.mockResolvedValue({ status: 'draft_unsaved' });
    mocks.saveRevision.mockResolvedValue({ revisionId: 'revision_2', workingVersion: 3 });
    render(<Workspace {...props} />);
    await waitFor(() => expect(disabled('保存版本')).toBe(false));

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });

    await waitFor(() => expect(mocks.saveRevision).toHaveBeenCalledWith('project_1', 'page_a', 2));
  });

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
