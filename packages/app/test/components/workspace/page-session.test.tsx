// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type {
  EditorInstance,
  EditorMode,
  CreateEditorOptions,
  EditorPlugin,
} from '@origamix/editor';
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
  editorRefresh: vi.fn(),
}));
// Model the public editor hooks while keeping the host persistence/recovery real.
type TestEditor = EditorInstance & { mode: EditorMode; plugins: readonly EditorPlugin[] };
const TestModeTools = () => {
  const editor = useContext(EditorTestContext)!;
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      {(['view', 'logic'] as const).map((mode) => (
        <button
          key={mode}
          aria-pressed={editor.mode === mode}
          onClick={() => {
            void editor.setMode(mode).catch((reason: Error) => setError(reason.message));
          }}
        >
          {mode === 'view' ? '视图' : '逻辑'}
        </button>
      ))}
      {error && <span role='alert'>{error}</span>}
    </>
  );
};
const EditorTestContext = createContext<TestEditor | null>(null);
vi.mock('@origamix/editor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@origamix/editor')>()),
  useCreateEditor: ({ beforeModeChange, plugins = [] }: CreateEditorOptions) => {
    const [mode, setMode] = useState<EditorMode>('view');
    return {
      mode,
      plugins,
      save: vi.fn(),
      setMode: async (next: EditorMode) => {
        await beforeModeChange?.();
        setMode(next);
      },
      undo: vi.fn(),
      redo: vi.fn(),
      setSchema: vi.fn(),
      setViewportWidth: vi.fn(),
    };
  },
  defineEditorPlugin: <Props,>(plugin: EditorPlugin<Props>) => ({
    ...plugin,
    withProps: (props: Props) => ({
      ...plugin,
      editor: {
        renderToolbar: (
          context: Parameters<NonNullable<NonNullable<EditorPlugin['editor']>['renderToolbar']>>[0],
        ) => plugin.editor?.renderToolbar?.({ ...context, props }),
      },
    }),
  }),
  ModeTools: () => <TestModeTools />,
  ViewportTools: () => null,
  HistoryTools: () => null,
  useEditorSelector: (selector: (state: object) => unknown) => {
    const editor = useContext(EditorTestContext)!;
    return selector({ mode: editor.mode, canUndo: false, canRedo: false, viewportWidth: 1440 });
  },
  useEditorContext: () => useContext(EditorTestContext)!,
}));
vi.mock('../../../src/services/agent', () => mocks);
vi.mock('../../../src/services/schema', () => ({ schemaService: mocks }));
vi.mock('../../../src/components/editor/index', () => ({
  PageEditor: ({
    readOnly,
    readOnlyMessage,
    onWorkingCommitted,
    visible,
    schemaRefreshKey,
    editor,
  }: {
    visible: boolean;
    schemaRefreshKey: string;
    editor: TestEditor;
    readOnly: boolean;
    readOnlyMessage?: string;
    onWorkingCommitted?: () => void;
  }) => {
    useEffect(() => mocks.editorMounted(), []);
    useEffect(() => mocks.editorRefresh(schemaRefreshKey), [schemaRefreshKey]);
    return (
      <EditorTestContext.Provider value={editor}>
        {visible &&
          editor.plugins.reduceRight<ReactNode>(
            (children, plugin) =>
              plugin.editor?.renderToolbar?.({ editor, area: 'all', children, props: undefined }) ??
              children,
            null,
          )}
        <button disabled={readOnly} aria-label='编辑画布' onClick={onWorkingCommitted}>
          {readOnlyMessage ?? '画布'}
        </button>
      </EditorTestContext.Provider>
    );
  },
}));
import { PageSession } from '../../../src/components/workspace/page-session';

const props = {
  pageId: 'page_a',
  editorRef: { current: null },
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

  it('keeps the current edit mode when flushing fails and retries without remounting the editor', async () => {
    mocks.listConversations.mockResolvedValue({ conversations: [] });
    mocks.applyState.mockResolvedValue({ status: 'in_sync' });
    await act(async () => useWorkspaceStore.getState().changePageMode('page_a', 'edit'));
    const flush = vi
      .fn()
      .mockRejectedValueOnce(new Error('草稿保存失败'))
      .mockResolvedValue(undefined);
    const editorRef = { current: { flush, undo: vi.fn(), redo: vi.fn() } };
    render(<PageSession {...props} editorRef={editorRef} active />);
    await waitFor(() => expect(screen.getAllByText('与项目一致')).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: '逻辑' }));
    await waitFor(() => expect(screen.getByText('草稿保存失败')).toBeTruthy());
    expect(screen.getByRole('button', { name: '视图' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '逻辑' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '逻辑' }).getAttribute('aria-pressed')).toBe(
        'true',
      ),
    );
    expect(flush).toHaveBeenCalledTimes(2);
    expect(mocks.editorMounted).toHaveBeenCalledTimes(1);
  });

  it('refreshes a visual Working commit before saving and applying the page', async () => {
    mocks.listConversations.mockResolvedValue({ conversations: [] });
    mocks.applyState.mockResolvedValue({ status: 'in_sync' });
    mocks.saveRevision.mockResolvedValue({ revisionId: 'revision_2', workingVersion: 2 });
    render(<PageSession {...props} active />);
    await waitFor(() => expect(screen.getByText('与项目一致')).toBeTruthy());
    const save = () => screen.getByRole('button', { name: '保存版本' }) as HTMLButtonElement;
    const apply = () => screen.getByRole('button', { name: '应用到项目' }) as HTMLButtonElement;
    expect(save().disabled).toBe(true);
    expect(apply().disabled).toBe(true);

    mocks.applyState.mockResolvedValue({ status: 'draft_unsaved' });
    fireEvent.click(screen.getByRole('button', { name: '编辑画布' }));
    await waitFor(() => expect(save().disabled).toBe(false));
    expect(apply().disabled).toBe(true);
    expect(mocks.editorMounted).toHaveBeenCalledTimes(1);

    mocks.applyState.mockResolvedValue({ status: 'saved_pending_apply' });
    fireEvent.click(save());
    await waitFor(() => expect(apply().disabled).toBe(false));
    expect(mocks.saveRevision).toHaveBeenCalledWith('project_1', 'page_a', 2);
    mocks.applyState.mockResolvedValue({ status: 'in_sync' });
    fireEvent.click(apply());
    await waitFor(() => expect(screen.getByText('与项目一致')).toBeTruthy());
    expect(mocks.apply).toHaveBeenCalledWith(
      'project_1',
      'page_a',
      'revision_1',
      2,
      expect.any(String),
    );
  });

  it('saves only the active page once per shortcut', async () => {
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
        <PageSession {...props} active />
        <div data-testid='second-page'>
          <PageSession {...second} />
        </div>
      </>,
    );
    await waitFor(() =>
      expect(
        screen
          .getAllByRole('button', { name: '保存版本' })
          .some((button) => !(button as HTMLButtonElement).disabled),
      ).toBe(true),
    );
    await act(async () => fireEvent.keyDown(window, { key: 's', ctrlKey: true }));
    await waitFor(() => expect(mocks.saveRevision).toHaveBeenCalledWith('project_1', 'page_a', 2));
    expect(mocks.saveRevision).toHaveBeenCalledOnce();
    mocks.saveRevision.mockClear();

    await act(async () =>
      view.rerender(
        <>
          <PageSession {...props} active={false} />
          <div data-testid='second-page'>
            <PageSession {...second} active />
          </div>
        </>,
      ),
    );
    await waitFor(() => {
      const save = within(screen.getByTestId('second-page')).getByRole('button', {
        name: '保存版本',
      });
      expect((save as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(mocks.saveRevision).toHaveBeenCalledWith('project_1', 'page_b', 2));
    expect(mocks.saveRevision).toHaveBeenCalledOnce();
    // In edit mode the retained hidden chat toolbar must not dispatch a second save.
    await act(async () => useWorkspaceStore.getState().changePageMode('page_b', 'edit'));
    await waitFor(() => expect(screen.getByRole('button', { name: '逻辑' })).toBeTruthy());
    mocks.saveRevision.mockClear();
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(mocks.saveRevision).toHaveBeenCalledTimes(1));
    expect(mocks.saveRevision).toHaveBeenCalledWith('project_1', 'page_b', 2);
  });

  it('signals a Working refresh without replacing the host session when an Agent commits', async () => {
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

    render(<PageSession {...props} active />);
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

    await waitFor(() => expect(mocks.editorRefresh.mock.lastCall?.[0]).toContain('3'));
    expect(mocks.editorMounted).toHaveBeenCalledTimes(1);
    await act(async () => useWorkspaceStore.getState().changePageMode('page_a', 'edit'));
    await act(async () => Promise.resolve());
    expect(mocks.editorMounted).toHaveBeenCalledTimes(1);
  });
});
