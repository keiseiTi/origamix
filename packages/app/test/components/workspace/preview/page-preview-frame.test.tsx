// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BUILTIN_PROJECT_STACK, SCHEMA_VERSION } from '@origamix/shared';

const mocks = vi.hoisted(() => ({
  workingState: vi.fn(),
  stack: vi.fn(),
  report: vi.fn(),
  pages: vi.fn(),
  config: vi.fn(),
  layoutWorking: vi.fn(),
}));
vi.mock('../../../../src/services/schema', () => ({ schemaService: mocks }));
vi.mock('../../../../src/services/projects', () => ({ projectsService: mocks }));
vi.mock('../../../../src/services/runtime', () => ({ runtimeService: mocks }));
import { PagePreviewFrame } from '../../../../src/components/workspace/preview/page-preview-frame';

const deferred = <T,>() => {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const working = (version: number) => ({
  revisionId: 'revision_saved',
  workingVersion: version,
  workingHash: String(version).repeat(64),
  schema: {
    elements: { element_root: { type: 'container', props: {} } },
    layout: { root: 'element_root', structure: { element_root: [] } },
    flows: {},
    bindElements: [],
    context: { globalVariables: [] },
    extensions: { origamix: { schemaVersion: SCHEMA_VERSION } },
  },
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

// Server cannot prove which iframe snapshot is current or ignore an old browser response.
it('ignores late snapshots, obsolete iframe reports and old report failures after Working advances', async () => {
  const first = deferred<ReturnType<typeof working>>(),
    report = deferred<unknown>();
  mocks.workingState
    .mockReturnValueOnce(first.promise)
    .mockResolvedValueOnce(working(2))
    .mockResolvedValue({ ...working(3), workingHash: working(2).workingHash });
  mocks.stack.mockResolvedValue(BUILTIN_PROJECT_STACK);
  mocks.config.mockResolvedValue({ enabled: false });
  mocks.pages.mockResolvedValue([
    { id: 'page_test', projectId: 'project_test', name: 'Test', slug: 'home' },
  ]);
  mocks.report.mockReturnValue(report.promise);
  const props = {
    projectId: 'project_test',
    pageId: 'page_test',
    pageName: 'Test',
    schemaRefreshKey: 'one',
    theme: 'light' as const,
  };
  const view = render(<PagePreviewFrame {...props} active />);
  const frame = view.getByTitle('Test 预览') as HTMLIFrameElement;
  const post = vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(() => undefined);
  const send = (data: Record<string, unknown>, target = frame) =>
    fireEvent(
      window,
      new MessageEvent('message', {
        source: target.contentWindow,
        data: { projectId: props.projectId, pageId: props.pageId, ...data },
      }),
    );
  await waitFor(() => expect(mocks.workingState).toHaveBeenCalledTimes(1));
  send({ type: 'origamix.preview.ready' });
  view.rerender(<PagePreviewFrame {...props} active schemaRefreshKey='two' />);
  await waitFor(() => expect(post).toHaveBeenCalled());
  const current = post.mock.calls.at(-1)![0].snapshot;
  expect(current.pageSchemas.page_test.workingVersion).toBe(2);
  await act(async () => first.resolve(working(1)));
  expect(
    post.mock.calls.every(
      ([message]) => message.snapshot?.pageSchemas.page_test.workingVersion !== 1,
    ),
  ).toBe(true);
  const outcome = {
    snapshotId: 'old-preview',
    pageId: 'page_test',
    pageHash: current.pageSchemas.page_test.hash,
    reportSequence: 1,
    outcome: 'success',
    diagnostics: [],
    observedAt: new Date().toISOString(),
  };
  send({ type: 'origamix.preview.outcome', report: outcome });
  expect(mocks.report).not.toHaveBeenCalled();
  send({
    type: 'origamix.preview.outcome',
    report: { ...outcome, snapshotId: current.snapshotId, pageId: 'page_other' },
  });
  send({
    type: 'origamix.preview.outcome',
    report: { ...outcome, snapshotId: current.snapshotId, pageHash: 'a'.repeat(64) },
  });
  expect(mocks.report).not.toHaveBeenCalled();
  send({
    type: 'origamix.preview.outcome',
    report: { ...outcome, snapshotId: current.snapshotId },
  });
  await waitFor(() => expect(mocks.report).toHaveBeenCalledOnce());

  view.rerender(<PagePreviewFrame {...props} active={false} schemaRefreshKey='two' />);
  mocks.workingState.mockResolvedValueOnce({ ...working(2), revisionId: 'revision_new' });
  view.rerender(<PagePreviewFrame {...props} active schemaRefreshKey='two' />);
  await waitFor(() => expect(mocks.workingState).toHaveBeenCalledTimes(3));
  expect(view.getByTitle('Test 预览')).toBe(frame);
  expect(post).toHaveBeenCalledOnce();

  view.rerender(<PagePreviewFrame {...props} active schemaRefreshKey='three' theme='dark' />);
  await waitFor(() => expect(view.getByTitle('Test 预览')).not.toBe(frame));
  const replacement = view.getByTitle('Test 预览') as HTMLIFrameElement;
  const replacementPost = vi.spyOn(replacement.contentWindow!, 'postMessage');
  send({ type: 'origamix.preview.ready' }, replacement);
  expect(replacementPost.mock.calls.at(-1)![0].snapshot.pageSchemas.page_test.workingVersion).toBe(
    3,
  );
  await act(async () => report.reject(new Error('obsolete report failure')));
  expect(view.queryByText(/obsolete report failure/)).toBeNull();
  mocks.workingState.mockRejectedValueOnce(new Error('page unavailable'));
  view.rerender(<PagePreviewFrame {...props} active schemaRefreshKey='four' />);
  await waitFor(() => expect(view.getByRole('alert').textContent).toContain('page unavailable'));
  expect(view.getByTitle('Test 预览')).toBe(replacement);
});

// File-mode iframe readiness can arrive between the completed host read and
// React's next commit. The callback must publish the authoritative ref, not an old render.
it('publishes the loaded snapshot when iframe readiness arrives before React commits the read', async () => {
  const pending = deferred<ReturnType<typeof working>>();
  mocks.workingState.mockReturnValue(pending.promise);
  mocks.stack.mockResolvedValue(BUILTIN_PROJECT_STACK);
  mocks.config.mockResolvedValue({ enabled: false });
  mocks.pages.mockResolvedValue([
    { id: 'page_test', projectId: 'project_test', name: 'Test', slug: 'home' },
  ]);
  const view = render(
    <PagePreviewFrame
      active
      projectId='project_test'
      pageId='page_test'
      pageName='Test'
      schemaRefreshKey=''
      theme='light'
    />,
  );
  const frame = view.getByTitle('Test 预览') as HTMLIFrameElement;
  const post = vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(() => undefined);
  await waitFor(() => expect(mocks.workingState).toHaveBeenCalledOnce());
  await act(async () => {
    pending.resolve(working(1));
    // Settle the read/composition microtasks while keeping React's render batched.
    for (let index = 0; index < 12; index += 1) await Promise.resolve();
    fireEvent(
      window,
      new MessageEvent('message', {
        source: frame.contentWindow,
        data: {
          type: 'origamix.preview.ready',
          projectId: 'project_test',
          pageId: 'page_test',
        },
      }),
    );
  });
  expect(post).toHaveBeenCalledOnce();
  expect(post.mock.calls[0]![0].snapshot.pageSchemas.page_test.workingVersion).toBe(1);
});
