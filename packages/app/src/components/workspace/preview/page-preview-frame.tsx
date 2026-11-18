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
  externalWorkingChange: number | symbol | null;
  theme: AppTheme;
}
export const PagePreviewFrame = ({
  active,
  projectId,
  pageId,
  pageName,
  externalWorkingChange,
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
  const snapshotPort = useRef<MessagePort | null>(null);

  const attachFrame = useCallback((frame: HTMLIFrameElement | null) => {
    if (frame !== iframeRef.current) {
      snapshotPort.current?.close();
      snapshotPort.current = null;
    }
    iframeRef.current = frame;
  }, []);

  useEffect(
    () => () => {
      generation.current += 1;
      currentSnapshot.current = null;
    },
    [projectId, pageId],
  );
  const previewUrl = useMemo(() => {
    const url = new URL('preview.html', document.baseURI);
    url.search = new URLSearchParams({ projectId, pageId }).toString();
    return url.toString();
  }, [pageId, projectId]);

  const publishSnapshot = useCallback(
    (next: PagePreviewSnapshot): void => {
      snapshotPort.current?.postMessage({
        type: 'origamix.preview.snapshot',
        projectId,
        pageId,
        snapshot: next,
      } satisfies HostToPreviewMessage);
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
        snapshotPort.current?.close();
        snapshotPort.current = null;
        setFrameKey(next.snapshotId);
      } else {
        publishSnapshot(next);
      }
    },
    [publishSnapshot],
  );

  useEffect(() => {
    const hot = import.meta.hot;
    if (!hot) return;
    const reload = () => {
      const retained = currentSnapshot.current;
      if (retained) replaceSnapshot({ ...retained, snapshotId: nanoid() });
    };
    hot.on('origamix:preview-updated', reload);
    return () => hot.off?.('origamix:preview-updated', reload);
  }, [replaceSnapshot]);

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
      if (
        !frameWindow ||
        event.source !== frameWindow ||
        event.origin !== 'null' ||
        !isPreviewToHostMessage(event.data)
      )
        return;
      if (event.data.projectId !== projectId || event.data.pageId !== pageId) return;
      if (event.data.type === 'origamix.preview.ready') {
        if (snapshotPort.current || event.ports.length !== 1) return;
        snapshotPort.current = event.ports[0];
        const retained = currentSnapshot.current;
        if (retained) publishSnapshot(retained);
      } else if (snapshotPort.current) {
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
  }, [active, externalWorkingChange, syncPreview]);

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
        ref={attachFrame}
        title={`${pageName} 预览`}
        className='size-full border-0 bg-white dark:bg-zinc-950'
        sandbox='allow-scripts'
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
