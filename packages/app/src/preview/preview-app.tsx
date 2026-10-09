import { Spinner } from '@/components/ui/spinner';
import { RuntimePreview } from '@/runtime/runtime-preview';
import type { PreviewSnapshot } from '@origamix/shared/page-window';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { isHostToPreviewMessage, type PreviewToHostMessage } from './protocol';

const postToHost = (message: PreviewToHostMessage): void => {
  window.parent.postMessage(message, '*');
};

export const PreviewApp = (): React.JSX.Element => {
  const [params] = useSearchParams();
  const projectId = params.get('projectId') ?? '';
  const pageId = params.get('pageId') ?? '';
  const [snapshot, setSnapshot] = useState<PreviewSnapshot | null>(null);
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

  if (error)
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

  return (
    <main className='h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100'>
      <RuntimePreview
        schema={snapshot.schema}
        revisionId={snapshot.revisionId}
        onOutcome={({ outcome, diagnostics }) =>
          postToHost({
            type: 'origamix.preview.outcome',
            projectId,
            pageId,
            revisionId: snapshot.revisionId,
            outcome,
            diagnostics,
          })
        }
      />
    </main>
  );
};
