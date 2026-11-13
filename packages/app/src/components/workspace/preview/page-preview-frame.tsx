import { nanoid } from 'nanoid';
import { Button } from '@origamix/ui';
import { EyeOff, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { equalJson, type PagePreviewReport, type PagePreviewSnapshot } from '@origamix/shared';
import { isPreviewToHostMessage, type HostToPreviewMessage } from '@/preview/protocol';
import { runtimeService } from '@/services/runtime';
import { loadPagePreviewSnapshot } from '@/preview/load-page-preview';
import { useWorkspaceStore } from '@/store/workspace';
import type { AppTheme } from '@/store/preferences';
interface PagePreviewFrameProps {
  active: boolean;
  projectId: string;
  pageId: string;
  pageName: string;
  schemaRefreshKey: string;
  theme: AppTheme;
}
export const PagePreviewFrame = ({
  active,
  projectId,
  pageId,
  pageName,
  schemaRefreshKey,
  theme,
}: PagePreviewFrameProps): React.JSX.Element | null => {
  const changePageMode = useWorkspaceStore((state) => state.changePageMode);
  const mode = useWorkspaceStore(
    (state) => state.openPages.find((tab) => tab.id === pageId)?.mode ?? 'chat',
  );
  const previousMode = useRef<'chat' | 'edit'>('chat');
  useEffect(() => {
    if (mode !== 'preview') previousMode.current = mode;
  }, [mode]);
  const [frameKey, setFrameKey] = useState<string | null>(active ? '' : null);
  if (active && frameKey === null) setFrameKey('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0);
  const currentSnapshot = useRef<PagePreviewSnapshot | null>(null);
  const reportSequence = useRef(0);
  const observedAt = useRef(0);
  const ready = useRef(false);

  useEffect(
    () => () => {
      generation.current += 1;
      currentSnapshot.current = null;
    },
    [projectId, pageId],
  );
  const previewUrl = useMemo(() => {
    const url = new URL(window.location.href);
    const search = new URLSearchParams({ projectId, pageId }).toString();
    if (url.protocol === 'file:') {
      url.search = '';
      url.hash = `/preview?${search}`;
    } else {
      url.pathname = '/preview';
      url.search = search;
      url.hash = '';
    }
    return url.toString();
  }, [pageId, projectId]);

  useEffect(() => {
    ready.current = false;
  }, [previewUrl]);

  const publishSnapshot = useCallback(
    (next: PagePreviewSnapshot): void => {
      if (ready.current)
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: 'origamix.preview.snapshot',
            projectId,
            pageId,
            snapshot: next,
          } satisfies HostToPreviewMessage,
          '*',
        );
    },
    [pageId, projectId],
  );

  const replaceSnapshot = useCallback(
    (next: PagePreviewSnapshot): void => {
      const hasRetainedSnapshot = currentSnapshot.current !== null;
      currentSnapshot.current = next;
      reportSequence.current = 0;
      setHasSnapshot(true);
      if (hasRetainedSnapshot) {
        // Ignore messages from the old frame while React mounts its replacement.
        iframeRef.current = null;
        ready.current = false;
        setFrameKey(next.snapshotId);
      } else {
        publishSnapshot(next);
      }
    },
    [publishSnapshot],
  );

  const readSnapshot = useCallback(
    async (apply: (next: PagePreviewSnapshot) => void): Promise<void> => {
      const requestGeneration = ++generation.current;
      setRefreshing(true);
      try {
        const next = await loadPagePreviewSnapshot(projectId, pageId, theme);
        if (requestGeneration !== generation.current) return;
        apply(next);
        setError(null);
      } catch (reason) {
        if (requestGeneration !== generation.current) return;
        const message = reason instanceof Error ? reason.message : '无法读取页面';
        setError(message);
      } finally {
        if (requestGeneration === generation.current) setRefreshing(false);
      }
    },
    [pageId, projectId, theme],
  );

  const refresh = () => readSnapshot(replaceSnapshot);

  const syncPreview = useCallback(
    () =>
      readSnapshot((next) => {
        const retained = currentSnapshot.current;
        if (
          retained &&
          retained.workingVersion === next.workingVersion &&
          retained.hash === next.hash &&
          equalJson(retained.stack, next.stack)
        ) {
          // Keep the runtime alive while updating the revision used for reports.
          currentSnapshot.current = { ...next, snapshotId: retained.snapshotId };
          return;
        }
        replaceSnapshot(next);
      }),
    [readSnapshot, replaceSnapshot],
  );

  const reportRender = useCallback(
    async (report: PagePreviewReport): Promise<void> => {
      const current = currentSnapshot.current;
      if (
        !current ||
        current.pageId !== report.pageId ||
        current.snapshotId !== report.snapshotId ||
        current.hash !== report.pageHash ||
        report.reportSequence <= reportSequence.current
      )
        return;
      reportSequence.current = report.reportSequence;
      observedAt.current = Math.max(Date.now(), observedAt.current + 1);
      const isCurrent = () => {
        const latest = currentSnapshot.current;
        return (
          latest?.snapshotId === report.snapshotId &&
          latest.workingVersion === current.workingVersion &&
          latest.revisionId === current.revisionId &&
          reportSequence.current === report.reportSequence
        );
      };
      try {
        const result = await runtimeService.report(projectId, report.pageId, {
          revisionId: current.revisionId,
          workingVersion: current.workingVersion,
          workingHash: current.hash,
          previewId: report.snapshotId,
          reportSequence: report.reportSequence,
          outcome: report.outcome,
          observedAt: new Date(observedAt.current).toISOString(),
          diagnostics: report.diagnostics.map((diagnostic) => ({
            ...diagnostic,
            pageId: report.pageId,
            revisionId: current.revisionId,
          })),
        });
        if (isCurrent() && result.disposition === 'accepted' && report.outcome === 'success')
          setError(null);
      } catch (reason) {
        if (isCurrent())
          setError(reason instanceof Error ? reason.message : '无法记录页面渲染状态');
      }
    },
    [projectId],
  );

  useEffect(() => {
    const receive = (event: MessageEvent): void => {
      const frameWindow = iframeRef.current?.contentWindow;
      if (!frameWindow || event.source !== frameWindow || !isPreviewToHostMessage(event.data))
        return;
      if (event.data.projectId !== projectId || event.data.pageId !== pageId) return;
      if (event.data.type === 'origamix.preview.ready') {
        const wasReady = ready.current;
        ready.current = true;
        // Read completion can precede React's commit. Read the same authority
        // used by report validation so readiness never misses that snapshot.
        const retained = currentSnapshot.current;
        if (retained) {
          const next = wasReady ? { ...retained, snapshotId: nanoid() } : retained;
          currentSnapshot.current = next;
          reportSequence.current = 0;
          publishSnapshot(next);
        }
      } else {
        void reportRender(event.data.report);
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [pageId, projectId, publishSnapshot, reportRender]);

  useEffect(() => {
    if (!active) return;
    const initial = window.setTimeout(() => void syncPreview(), 0);
    return () => {
      window.clearTimeout(initial);
      generation.current += 1;
    };
  }, [active, schemaRefreshKey, syncPreview]);

  useEffect(() => {
    const retained = currentSnapshot.current;
    if (!retained || retained.theme === theme) return;
    const next = { ...retained, theme };
    currentSnapshot.current = next;
    publishSnapshot(next);
  }, [publishSnapshot, theme]);

  if (frameKey === null) return null;

  return (
    <div className='relative size-full bg-white dark:bg-zinc-950'>
      <iframe
        key={frameKey}
        ref={iframeRef}
        title={`${pageName} 预览`}
        className='size-full border-0 bg-white dark:bg-zinc-950'
        sandbox='allow-same-origin allow-scripts'
        src={previewUrl}
      />
      <Button
        size='icon-sm'
        variant='secondary'
        className='absolute top-3 right-3 z-50 shadow-md'
        aria-label='退出预览'
        onClick={() => void changePageMode(pageId, previousMode.current)}
      >
        <EyeOff size={17} />
      </Button>
      <Button
        size='icon-sm'
        variant='secondary'
        className='absolute top-3 right-14 z-50 shadow-md'
        aria-label='刷新页面预览'
        disabled={refreshing}
        onClick={() => void refresh()}
      >
        <RefreshCw size={17} className={refreshing ? 'animate-spin' : undefined} />
      </Button>
      {error && (
        <div
          role='alert'
          className='absolute top-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-danger/10 p-4 text-sm text-danger backdrop-blur'
        >
          <span>
            {error}。{hasSnapshot ? '保留上次应用快照。' : '请重试。'}
          </span>
          <Button
            size='icon-sm'
            variant='secondary'
            aria-label='重试预览'
            disabled={refreshing}
            onClick={() => void refresh()}
          >
            <RefreshCw size={15} />
          </Button>
        </div>
      )}
    </div>
  );
};
