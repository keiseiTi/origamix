// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BUILTIN_PROJECT_STACK, ORIGAMIX_VERSION } from '@origamix/shared';

const mocks = vi.hoisted(() => ({ workingState: vi.fn(), stack: vi.fn(), report: vi.fn() }));
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
    extensions: { origamix: { schemaVersion: ORIGAMIX_VERSION } },
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
    .mockResolvedValue(working(3));
  mocks.stack.mockResolvedValue(BUILTIN_PROJECT_STACK);
  mocks.report.mockReturnValue(report.promise);
  const props = {
    projectId: 'project_test',
    pageId: 'page_test',
    pageName: 'Test',
    schemaRefreshKey: 'one',
    theme: 'light' as const,
    onExit: vi.fn(),
  };
  const view = render(<PagePreviewFrame {...props} active={false} />);
  const frame = view.getByTitle('Test 预览') as HTMLIFrameElement;
  const post = vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(() => undefined);
  const send = (data: Record<string, unknown>) =>
    fireEvent(
      window,
      new MessageEvent('message', {
        source: frame.contentWindow,
        data: { projectId: props.projectId, pageId: props.pageId, ...data },
      }),
    );
  send({ type: 'origamix.preview.ready' });
  await waitFor(() => expect(mocks.workingState).toHaveBeenCalledTimes(1));
  view.rerender(<PagePreviewFrame {...props} active schemaRefreshKey='two' />);
  await waitFor(() => expect(post).toHaveBeenCalled());
  const current = post.mock.calls.at(-1)![0].snapshot;
  expect(current.workingVersion).toBe(2);
  await act(async () => first.resolve(working(1)));
  expect(post.mock.calls.every(([message]) => message.snapshot?.workingVersion !== 1)).toBe(true);
  const outcome = {
    type: 'origamix.preview.outcome',
    revisionId: current.revisionId,
    workingVersion: current.workingVersion,
    workingHash: current.workingHash,
    previewId: 'old-preview',
    reportSequence: 1,
    outcome: 'success',
    diagnostics: [],
    observedAt: new Date().toISOString(),
  };
  send(outcome);
  expect(mocks.report).not.toHaveBeenCalled();
  send({ ...outcome, previewId: current.previewId });
  await waitFor(() => expect(mocks.report).toHaveBeenCalledOnce());
  view.rerender(<PagePreviewFrame {...props} active schemaRefreshKey='three' theme='dark' />);
  await waitFor(() => expect(post.mock.calls.at(-1)![0].snapshot.workingVersion).toBe(3));
  await act(async () => report.reject(new Error('obsolete report failure')));
  expect(view.queryByText(/obsolete report failure/)).toBeNull();
});
