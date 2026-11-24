// @vitest-environment happy-dom
import { Toaster } from '@origamix/ui';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { SCHEMA_VERSION, type OrigamixPageSchema } from '@origamix/shared';
import type {
  EditorInstance,
  EditorMode,
  CreateEditorOptions,
  EditorPlugin,
} from '@origamix/editor';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePendingOperations } from '@/store/pending-operations';
import { useWorkspaceStore } from '@/store/workspace';

vi.mock('@/services/projects', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/projects')>()),
  workbenchHost: () => 'desktop',
}));

const mocks = vi.hoisted(() => ({
  listConversations: vi.fn(),
  listAllMessages: vi.fn(),
  getAgentRun: vi.fn(),
  createAgentRun: vi.fn(),
  cancelAgentRun: vi.fn(),
  subscribeAgentEvents: vi.fn(),
  applyState: vi.fn(),
  workingState: vi.fn(),
  applyWorkingOperations: vi.fn(),
  saveRevision: vi.fn(),
  apply: vi.fn(),
  reloadFromProject: vi.fn(),
  listRevisions: vi.fn(),
  getRevision: vi.fn(),
  restoreRevision: vi.fn(),
  editorMounted: vi.fn(),
  flush: vi.fn<() => Promise<void> | undefined>(),
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
const schema: OrigamixPageSchema = {
  elements: { element_root: { type: 'container', props: {} } },
  layout: { root: 'element_root', structure: { element_root: [] } },
  flows: {},
  bindElements: [],
  context: { globalVariables: [] },
  extensions: { origamix: { schemaVersion: SCHEMA_VERSION } },
};
vi.mock('@/materials/use-editor-materials', () => ({
  useEditorMaterials: () => ({ registration: {} }),
}));
vi.mock('@/services/agent', () => mocks);
vi.mock('@/services/schema', () => ({ schemaService: mocks }));
vi.mock('@/components/editor/index', () => ({
  PageEditor: ({
    readOnly,
    readOnlyMessage,
    working,
    visible,
    editor,
  }: {
    visible: boolean;
    working: ReturnType<typeof import('@/components/editor/use-editor-session').useEditorSession>;
    editor: TestEditor;
    readOnly: boolean;
    readOnlyMessage?: string;
  }) => {
    useEffect(() => mocks.editorMounted(), []);
    return (
      <EditorTestContext.Provider value={editor}>
        <div data-testid='editor-toolbar'>
          {visible &&
            editor.plugins.reduceRight<ReactNode>(
              (children, plugin) =>
                plugin.editor?.renderToolbar?.({
                  editor,
                  area: 'all',
                  children,
                  props: undefined,
                }) ?? children,
              null,
            )}
        </div>
        {visible && (
          <output aria-label='画布 Schema'>{JSON.stringify(working.snapshot?.schema)}</output>
        )}
        <button
          disabled={readOnly || working.loading || working.refreshing}
          aria-label='编辑画布'
          onClick={() => {
            const current = working.snapshot?.schema;
            if (!current) return;
            working.onChange(
              {
                ...current,
                elements: {
                  ...current.elements,
                  element_root: {
                    ...current.elements.element_root,
                    props: { ...current.elements.element_root.props, padding: 24 },
                  },
                },
              },
              { immediate: true },
            );
          }}
        >
          {readOnlyMessage ?? '画布'}
        </button>
      </EditorTestContext.Provider>
    );
  },
}));
import { PageSession } from '@/components/workspace/page-session';

const editorRef = { current: null };
vi.mock('@/components/editor/use-editor-session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/editor/use-editor-session')>();
  return {
    useEditorSession: (...args: Parameters<typeof actual.useEditorSession>) => {
      const working = actual.useEditorSession(...args);
      return { ...working, flush: async () => mocks.flush() ?? working.flush() };
    },
  };
});
const props = {
  pageId: 'page_a',
  editorRef,
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
    mocks.workingState.mockResolvedValue({
      revisionId: 'revision_1',
      workingVersion: 2,
      schema,
    });
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
    mocks.flush.mockRejectedValueOnce(new Error('草稿保存失败'));
    render(<PageSession {...props} active />, { wrapper: Toaster });
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
    expect(mocks.flush).toHaveBeenCalledTimes(2);
    expect(mocks.editorMounted).toHaveBeenCalledTimes(1);
  });

  it('saves only the active page once per shortcut', async () => {
    mocks.listConversations.mockResolvedValue({ conversations: [] });
    mocks.applyState.mockResolvedValue({ status: 'draft_unsaved' });
    mocks.saveRevision.mockResolvedValue({
      revisionId: 'revision_2',
      workingVersion: 2,
      schema,
    });
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

  it('continues an Agent draft through visual editing, explicit save and Apply', async () => {
    mocks.applyState.mockResolvedValue({ status: 'in_sync' });
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

    const agentSchema = {
      ...schema,
      elements: { element_root: { type: 'container', props: { height: 320 } } },
    };
    mocks.workingState.mockClear();
    mocks.workingState.mockResolvedValue({
      revisionId: 'revision_1',
      workingVersion: 3,
      schema: agentSchema,
    });
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

    await waitFor(() => expect(mocks.workingState).toHaveBeenCalledWith('project_1', 'page_a'));
    expect(mocks.editorMounted).toHaveBeenCalledTimes(1);
    await act(async () => useWorkspaceStore.getState().changePageMode('page_a', 'edit'));
    await waitFor(() =>
      expect(screen.getByLabelText('画布 Schema').textContent).toBe(JSON.stringify(agentSchema)),
    );
    mocks.getAgentRun.mockResolvedValue({
      run: { runId: 'run_1', pageId: 'page_a', status: 'completed', resultWorkingVersion: 3 },
    });
    listener!.onEvent({
      version: '1',
      eventId: 2,
      sequence: 2,
      type: 'run.completed',
      runId: 'run_1',
      pageId: 'page_a',
      requestId: 'request_1',
      occurredAt: '2026-09-23T00:00:01.000Z',
      payload: { outcome: 'changed', resultWorkingVersion: 3 },
    });
    const finalSchema = {
      ...agentSchema,
      elements: { element_root: { type: 'container', props: { height: 320, padding: 24 } } },
    };
    mocks.applyWorkingOperations.mockResolvedValue({
      revisionId: 'revision_1',
      workingVersion: 4,
      schema: finalSchema,
    });
    const toolbar = within(screen.getByTestId('editor-toolbar'));
    const save = () => toolbar.getByRole<HTMLButtonElement>('button', { name: '保存版本' });
    const apply = () => toolbar.getByRole<HTMLButtonElement>('button', { name: '应用到项目' });
    const canvas = screen.getByRole<HTMLButtonElement>('button', { name: '编辑画布' });
    await waitFor(() => expect(canvas.disabled).toBe(false));
    expect(save().disabled).toBe(true);
    expect(apply().disabled).toBe(true);
    mocks.applyState.mockResolvedValue({ status: 'draft_unsaved' });
    fireEvent.click(canvas);
    await waitFor(() =>
      expect(mocks.applyWorkingOperations).toHaveBeenCalledWith('project_1', 'page_a', 3, [
        {
          operation: 'updateElementProps',
          elementId: 'element_root',
          set: { padding: 24 },
        },
      ]),
    );
    await waitFor(() => expect(save().disabled).toBe(false));
    expect(apply().disabled).toBe(true);

    const saved = { schema: finalSchema, revisionId: 'revision_2', workingVersion: 5 };
    mocks.saveRevision.mockResolvedValue(saved);
    mocks.workingState.mockResolvedValue(saved);
    mocks.applyState.mockResolvedValue({ status: 'saved_pending_apply' });
    fireEvent.click(save());
    await waitFor(() => expect(apply().disabled).toBe(false));
    expect(mocks.saveRevision).toHaveBeenCalledWith('project_1', 'page_a', 4);
    expect(mocks.apply).not.toHaveBeenCalled();

    mocks.applyState.mockResolvedValue({ status: 'in_sync' });
    fireEvent.click(apply());
    await waitFor(() =>
      expect(mocks.apply).toHaveBeenCalledWith(
        'project_1',
        'page_a',
        'revision_2',
        5,
        expect.any(String),
      ),
    );
    expect(mocks.editorMounted).toHaveBeenCalledTimes(1);
  });
});
