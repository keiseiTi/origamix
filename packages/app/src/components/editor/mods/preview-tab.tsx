import { Button, Spinner } from '@heroui/react';
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import { schemaService } from '../../../services/schema';
import { RuntimePreview } from './runtime-preview';

export function PreviewTab({
  projectId,
  pageId,
}: {
  projectId: string;
  pageId: string;
}): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<{
    schema: OrigamixPageSchema;
    revisionId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await schemaService.get(projectId, pageId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法加载预览');
    } finally {
      setLoading(false);
    }
  }, [pageId, projectId]);

  useEffect(() => {
    let active = true;
    schemaService
      .get(projectId, pageId)
      .then((result) => active && setSnapshot(result))
      .catch(
        (reason) => active && setError(reason instanceof Error ? reason.message : '无法加载预览'),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [pageId, projectId]);

  return (
    <section
      className='relative flex min-h-0 flex-1 flex-col bg-white dark:bg-zinc-950'
      aria-label='页面预览'
    >
      <div className='absolute top-3 right-3 z-10'>
        <Button
          isIconOnly
          size='sm'
          variant='secondary'
          aria-label='刷新预览'
          isDisabled={loading}
          onPress={() => void refresh()}
        >
          <RefreshCw size={15} />
        </Button>
      </div>
      {error && (
        <div
          role='alert'
          className='m-4 flex items-center justify-between gap-3 rounded-lg bg-danger/10 p-3 text-sm text-danger'
        >
          <span>
            {error}
            {snapshot ? '，继续显示上次成功版本。' : ''}
          </span>
          <Button size='sm' variant='secondary' onPress={() => void refresh()}>
            重试
          </Button>
        </div>
      )}
      {loading && !snapshot ? (
        <div className='grid flex-1 place-items-center'>
          <Spinner aria-label='加载预览' />
        </div>
      ) : snapshot ? (
        <RuntimePreview schema={snapshot.schema} revisionId={snapshot.revisionId} />
      ) : null}
    </section>
  );
}
