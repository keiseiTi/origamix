import { Spinner } from '@origamix/ui';
import { RuntimePreview } from '@/preview/runtime-preview';
import { type ApplicationSnapshot } from '@origamix/shared';
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
  const [snapshot, setSnapshot] = useState<ApplicationSnapshot | null>(null);
  const reportSequence = useRef(0);
  const [error, setError] = useState<string | null>(
    projectId && pageId ? null : '预览 URL 缺少 projectId 或 pageId',
  );

  useEffect(() => {
    if (!projectId || !pageId) return;
    const receive = (event: MessageEvent): void => {
      if (event.source !== window.parent || !isHostToPreviewMessage(event.data)) return;
      if (event.data.projectId !== projectId || event.data.pageId !== pageId) return;
      if (event.data.type === 'origamix.preview.snapshot') {
        setSnapshot(event.data.snapshot);
        setError(null);
        document.documentElement.dataset.theme = event.data.snapshot.theme;
        document.documentElement.classList.toggle('dark', event.data.snapshot.theme === 'dark');
      } else {
        setError(event.data.message);
      }
    };
    window.addEventListener('message', receive);
    postToHost({ type: 'origamix.preview.ready', projectId, pageId });
    return () => window.removeEventListener('message', receive);
  }, [pageId, projectId]);

  if (error && !snapshot)
    return (
      <div role='alert' className='grid h-screen place-items-center p-6 text-sm text-danger'>
        {error}
      </div>
    );
  if (!snapshot)
    return (
      <div className='grid h-screen place-items-center'>
        <Spinner aria-label='读取页面' />
      </div>
    );

  const currentPageId = snapshot.initialPageId;
  const page = currentPageId ? snapshot.pageSchemas[currentPageId] : null;
  if (!page || !currentPageId)
    return (
      <div className='grid h-screen place-content-center gap-2 p-6 text-center text-sm'>
        <strong>项目中还没有页面</strong>
        <span className='text-muted-foreground'>退出预览并创建页面后，即可预览完整应用。</span>
      </div>
    );
  return (
    <main className='flex h-screen flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100'>
      <div className='min-h-0 flex-1 overflow-auto'>
        <RuntimePreview
          stack={snapshot.stack}
          theme={snapshot.theme}
          schema={page.schema}
          pageId={currentPageId}
          revisionId={`${snapshot.snapshotId}:${currentPageId}`}
          onOutcome={({ outcome, diagnostics }) =>
            postToHost({
              type: 'origamix.preview.outcome',
              projectId,
              pageId,
              report: {
                snapshotId: snapshot.snapshotId,
                pageId: currentPageId,
                pageHash: page.hash,
                reportSequence: ++reportSequence.current,
                observedAt: new Date().toISOString(),
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
