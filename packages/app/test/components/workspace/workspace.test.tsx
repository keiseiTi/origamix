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
  get: vi.fn(),
  apply: vi.fn(),
  reloadFromProject: vi.fn(),
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
  onUndo: vi.fn(),
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
    mocks.applyState.mockResolvedValue({ status: 'pending' });
    mocks.get.mockResolvedValue({ revisionId: 'revision_1' });
    mocks.listConversations.mockRejectedValue(new Error('无法恢复对话'));
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
      expect(disabled('撤销页面修改')).toBe(true);
      expect(disabled('发送')).toBe(true);
      await screen.findByText('无法恢复对话');
      expect(disabled('应用到项目')).toBe(true);
      mocks.listConversations.mockResolvedValue({ conversations: [] });
      fireEvent.click(screen.getByRole('button', { name: '重试' }));
      await waitFor(() => expect(disabled('编辑画布')).toBe(false));
      expect(disabled('撤销页面修改')).toBe(false);
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
    expect(mocks.apply.mock.calls[1]![3]).toBe(mocks.apply.mock.calls[0]![3]);
  });
});
