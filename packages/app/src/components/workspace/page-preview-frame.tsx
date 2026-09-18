import { Button, Spinner } from '@heroui/react';
import { EyeOff, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PreviewRenderDiagnostic, PreviewSnapshot } from '@origamix/shared/page-window';
import { RuntimePreview } from '../../runtime/runtime-preview';
import { runtimeService } from '../../services/runtime';
import { schemaService } from '../../services/schema';
import type { AppTheme } from '../../store/preferences';

interface PagePreviewFrameProps {
  active: boolean;
  projectId: string;
  pageId: string;
  pageName: string;
  theme: AppTheme;
  onExit: () => void;
}

const copyStyles = (target: Document): void => {
  target.head.replaceChildren();
  for (const node of document.head.querySelectorAll('style, link[rel="stylesheet"]')) {
    target.head.append(node.cloneNode(true));
  }
};

const PreviewSurface = ({
  active,
  projectId,
  pageId,
  theme,
  onExit,
}: Omit<PagePreviewFrameProps, 'pageName'>): React.JSX.Element => {
  const [snapshot, setSnapshot] = useState<PreviewSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const pending = useRef(false);
  const reported = useRef(new Set<string>());

  const refresh = useCallback(
    async (manual = false): Promise<void> => {
      if (pending.current) return;
      pending.current = true;
      if (manual) setRefreshing(true);
      try {
        const result = await schemaService.get(projectId, pageId);
        setSnapshot((current) =>
          current?.revisionId === result.revisionId && current.theme === theme
            ? current
            : { ...result, theme },
        );
        setError(null);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '无法读取页面');
      } finally {
        pending.current = false;
        setRefreshing(false);
      }
    },
    [pageId, projectId, theme],
  );

  const reportRender = useCallback(
    async (
      revisionId: string,
      outcome: 'success' | 'failed',
      diagnostics: PreviewRenderDiagnostic[],
    ): Promise<void> => {
      const reportKey = `${revisionId}:${outcome}`;
      if (reported.current.has(reportKey)) return;
      reported.current.add(reportKey);
      try {
        const result = await runtimeService.report(projectId, pageId, {
          revisionId,
          outcome,
          diagnostics: diagnostics.map((diagnostic) => ({
            ...diagnostic,
            pageId,
            revisionId,
          })),
          observedAt: new Date().toISOString(),
        });
        if (result.visualRevisionId && result.visualRevisionId !== revisionId) {
          const visual = await schemaService.getRevision(
            projectId,
            pageId,
            result.visualRevisionId,
          );
          setSnapshot({ ...visual, theme });
          setError('当前版本渲染失败，已回退到最近一次正常预览');
        } else if (outcome === 'success') {
          setError(null);
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '无法记录页面渲染状态');
      }
    },
    [pageId, projectId, theme],
  );

  useEffect(() => {
    if (!active) return;
    const initial = window.setTimeout(() => void refresh(true), 0);
    const timer = window.setInterval(() => void refresh(), 1500);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [active, refresh]);

  return (
    <main className='relative flex h-full flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100'>
      <Button
        isIconOnly
        size='sm'
        variant='secondary'
        className='fixed top-4 right-4 z-50 shadow-md'
        aria-label='退出预览'
        onClick={onExit}
      >
        <EyeOff size={17} />
      </Button>
      {error && (
        <div
          role='alert'
          className='fixed top-4 left-1/2 z-40 flex -translate-x-1/2 items-center justify-between gap-3 rounded-lg bg-danger/10 p-4 text-sm text-danger backdrop-blur'
        >
          <span>
            {error}。{snapshot ? '保留上次成功预览。' : '请重试。'}
          </span>
          <Button
            isIconOnly
            size='sm'
            variant='secondary'
            aria-label='重试预览'
            isDisabled={refreshing}
            onPress={() => void refresh(true)}
          >
            <RefreshCw size={15} />
          </Button>
        </div>
      )}
      {snapshot ? (
        <RuntimePreview
          schema={snapshot.schema}
          revisionId={snapshot.revisionId}
          onOutcome={({ outcome, diagnostics }) =>
            void reportRender(snapshot.revisionId, outcome, diagnostics)
          }
        />
      ) : (
        !error && (
          <div className='grid flex-1 place-items-center'>
            <Spinner aria-label='读取页面' />
          </div>
        )
      )}
    </main>
  );
};

export const PagePreviewFrame = (props: PagePreviewFrameProps): React.JSX.Element => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [frameDocument, setFrameDocument] = useState<Document | null>(null);

  useEffect(() => {
    const target = iframeRef.current?.contentDocument;
    if (!target) return;
    target.documentElement.classList.toggle('dark', props.theme === 'dark');
    target.documentElement.dataset.theme = props.theme;
  }, [props.theme]);

  return (
    <>
      <iframe
        ref={iframeRef}
        title={`${props.pageName} 预览`}
        className='size-full border-0 bg-white dark:bg-zinc-950'
        sandbox='allow-same-origin allow-scripts'
        srcDoc='<!doctype html><html><head></head><body></body></html>'
        onLoad={(event) => {
          const target = event.currentTarget.contentDocument;
          if (!target) return;
          copyStyles(target);
          target.documentElement.className = document.documentElement.className;
          target.documentElement.dataset.theme = props.theme;
          target.documentElement.style.height = '100%';
          target.body.className = 'm-0 h-full overflow-hidden';
          setFrameDocument(target);
        }}
      />
      {frameDocument && createPortal(<PreviewSurface {...props} />, frameDocument.body)}
    </>
  );
};
