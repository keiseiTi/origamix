import { Spinner } from '@origamix/ui';
import { RuntimePreview } from '@/preview/runtime-preview';
import { type PagePreviewSnapshot } from '@origamix/shared';
import { useEffect, useState, useRef } from 'react';
import { isHostToPreviewMessage, type PreviewToHostMessage } from './protocol';

const postToHost = (message: PreviewToHostMessage): void => {
  const target = location.protocol === 'file:' ? '*' : location.origin;
  window.parent.postMessage(message, target);
};

export const PreviewApp = (): React.JSX.Element => {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('projectId') ?? '';
  const pageId = params.get('pageId') ?? '';
  const [snapshot, setSnapshot] = useState<PagePreviewSnapshot | null>(null);
  const reportSequence = useRef(0);
  useEffect(() => {
    if (!projectId || !pageId) return;
    const channel = new MessageChannel();
    channel.port1.onmessage = (event: MessageEvent): void => {
      if (!isHostToPreviewMessage(event.data)) return;
      if (event.data.projectId !== projectId || event.data.pageId !== pageId) return;
      const next = event.data.snapshot;
      setSnapshot((current) =>
        current?.snapshotId === next.snapshotId ? { ...current, theme: next.theme } : next,
      );
      document.documentElement.dataset.theme = event.data.snapshot.theme;
      document.documentElement.classList.toggle('dark', event.data.snapshot.theme === 'dark');
    };
    const target = location.protocol === 'file:' ? '*' : location.origin;
    window.parent.postMessage({ type: 'origamix.preview.ready', projectId, pageId }, target, [
      channel.port2,
    ]);
    return () => channel.port1.close();
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
