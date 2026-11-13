import { Spinner } from '@origamix/ui';
import { RuntimePreview } from '@/preview/runtime-preview';
import { type PagePreviewSnapshot } from '@origamix/shared';
import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { isHostToPreviewMessage, type PreviewToHostMessage } from './protocol';

const postToHost = (message: PreviewToHostMessage): void => {
  window.parent.postMessage(message, '*');
};

export const PreviewApp = (): React.JSX.Element => {
  const [params] = useSearchParams();
  const projectId = params.get('projectId') ?? '';
  const pageId = params.get('pageId') ?? '';
  const [snapshot, setSnapshot] = useState<PagePreviewSnapshot | null>(null);
  const reportSequence = useRef(0);
  useEffect(() => {
    if (!projectId || !pageId) return;
    const receive = (event: MessageEvent): void => {
      if (event.source !== window.parent || !isHostToPreviewMessage(event.data)) return;
      if (event.data.projectId !== projectId || event.data.pageId !== pageId) return;
      const next = event.data.snapshot;
      setSnapshot((current) =>
        current?.snapshotId === next.snapshotId ? { ...current, theme: next.theme } : next,
      );
      document.documentElement.dataset.theme = event.data.snapshot.theme;
      document.documentElement.classList.toggle('dark', event.data.snapshot.theme === 'dark');
    };
    window.addEventListener('message', receive);
    postToHost({ type: 'origamix.preview.ready', projectId, pageId });
    return () => window.removeEventListener('message', receive);
  }, [pageId, projectId]);

  if (!projectId || !pageId)
    return (
      <div role='alert' className='grid h-screen place-items-center p-6 text-sm text-danger'>
        预览缺少项目或页面标识
      </div>
    );
  if (!snapshot)
    return (
      <div className='grid h-screen place-items-center'>
        <Spinner aria-label='读取页面' />
      </div>
    );

  return (
    <main className='flex h-screen flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100'>
      <div className='min-h-0 flex-1 overflow-auto'>
        <RuntimePreview
          stack={snapshot.stack}
          theme={snapshot.theme}
          schema={snapshot.schema}
          pageId={pageId}
          revisionId={`${snapshot.snapshotId}:${pageId}`}
          onOutcome={({ outcome, diagnostics }) =>
            postToHost({
              type: 'origamix.preview.outcome',
              projectId,
              pageId,
              report: {
                snapshotId: snapshot.snapshotId,
                pageId,
                pageHash: snapshot.hash,
                reportSequence: ++reportSequence.current,
                outcome,
                diagnostics,
              },
            })
          }
        />
      </div>
    </main>
  );
};
