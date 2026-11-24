import { ErrorToast } from '@/components/error-toast';
import {
  equalJson as sameEvidence,
  type AgentMessage,
  type AgentRun,
  type RuntimeRepairEvidence,
} from '@origamix/shared';
import { findRepairReplay } from '@/preview/runtime-repair';
import type { RuntimeObservation } from '@origamix/runtime';
import { PreviewDiagnostics } from './preview-diagnostics';
import { parsePreviewObservation } from '@/preview/observation-protocol';
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
  repairAgent?: {
    activity: 'idle' | 'running' | 'unknown';
    run: AgentRun | null;
    messages: AgentMessage[];
    submit: (evidence: RuntimeRepairEvidence, version: number) => Promise<void>;
  };
}
export const PagePreviewFrame = ({
  active,
  projectId,
  pageId,
  pageName,
  externalWorkingChange,
  theme,
  repairAgent,
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
  const [repair, setRepair] = useState<RuntimeRepairEvidence | null>(null);
  const [linkedRun, setLinkedRun] = useState<AgentRun | null>(null);
  const [repairError, setRepairError] = useState<string | null>(null);
  const [repairSubmitting, setRepairSubmitting] = useState(false);
  const [verifiedReplay, setVerifiedReplay] = useState<{
    evidence: RuntimeRepairEvidence;
    snapshotId: string;
    executionId: number;
  } | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [observation, setObservation] = useState<{
    records: RuntimeObservation[];
    dropped: number;
  }>({ records: [], dropped: 0 });
  const [renderDiagnostics, setRenderDiagnostics] = useState<PagePreviewReport['diagnostics']>([]);
  const [displayedSnapshot, setDisplayedSnapshot] = useState<PagePreviewSnapshot | null>(null);
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
      setObservation({ records: [], dropped: 0 });
      setRenderDiagnostics([]);
      setDisplayedSnapshot(next);
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
      setRenderDiagnostics(report.diagnostics);
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
        const port = event.ports[0];
        snapshotPort.current = port;
        let lastSequence = 0;
        let runtimeSessionId: string | undefined;
        port.onmessage = ({ data }: MessageEvent<unknown>) => {
          const snapshot = currentSnapshot.current;
          if (snapshotPort.current !== port || !snapshot) return;
          const record = parsePreviewObservation(data, snapshot.snapshotId);
          if (
            !record ||
            (runtimeSessionId && record.runtimeSessionId !== runtimeSessionId) ||
            record.sequence <= lastSequence
          )
            return;
          if (
            record.kind === 'flow' &&
            (!Object.hasOwn(snapshot.schema.elements, record.elementId) ||
              !Object.hasOwn(snapshot.schema.flows, record.flowId))
          )
            return;
          runtimeSessionId = record.runtimeSessionId;
          const gap = record.sequence - lastSequence - 1;
          lastSequence = record.sequence;
          setObservation((current) => {
            // The validated field lengths bound each entry by a fixed worst-case JSON size.
            const records = [...current.records, record];
            const excess = Math.max(0, records.length - 100);
            if (excess) {
              // Preserve the latest render status while keeping intervening records for trace checks.
              const preserveFirst =
                records[0]?.kind === 'render' &&
                !records.some((entry, index) => index > 0 && entry.kind === 'render');
              records.splice(preserveFirst ? 1 : 0, excess);
            }
            return { records, dropped: current.dropped + gap + excess };
          });
        };
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

  const agentRun = repairAgent?.run;
  const matchingRun =
    repair &&
    agentRun &&
    repairAgent?.messages.some(
      (message) =>
        message.messageId === agentRun.userMessageId &&
        message.content.blocks.some(
          (block) => block.type === 'runtime_repair' && sameEvidence(block, repair),
        ),
    )
      ? agentRun
      : null;
  if (matchingRun && matchingRun !== linkedRun) setLinkedRun(matchingRun);
  const repairRun = matchingRun ?? linkedRun;
  const repairedVersion = repairRun?.resultWorkingVersion;
  const onRepairedSnapshot = Boolean(
    repairedVersion &&
    displayedSnapshot &&
    displayedSnapshot.snapshotId !== repair?.snapshotId &&
    displayedSnapshot.workingVersion === repairedVersion &&
    displayedSnapshot.hash === repairRun?.resultWorkingHash,
  );
  const replay =
    repair && onRepairedSnapshot ? findRepairReplay(repair, observation.records) : undefined;
  const verified = Boolean(
    verifiedReplay &&
    verifiedReplay.evidence === repair &&
    verifiedReplay.snapshotId === displayedSnapshot?.snapshotId &&
    onRepairedSnapshot,
  );
  const submitRepair = async (evidence: RuntimeRepairEvidence, version: number) => {
    if (!repairAgent || repairSubmitting || repairAgent.activity !== 'idle') return;
    setRepair(evidence);
    setLinkedRun(null);
    setRepairError(null);
    setVerifiedReplay(null);
    setRepairSubmitting(true);
    try {
      await repairAgent.submit(evidence, version);
    } catch (reason) {
      setRepairError(
        reason instanceof Error ? reason.message : '修复请求待确认，请查看 Agent 对话。',
      );
    } finally {
      setRepairSubmitting(false);
    }
  };

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
      <Button
        size='sm'
        variant='secondary'
        className='absolute top-3 right-24 z-50'
        aria-pressed={showDiagnostics}
        onClick={() => setShowDiagnostics((open) => !open)}
      >
        运行诊断
      </Button>
      {showDiagnostics && (
        <PreviewDiagnostics
          records={observation.records}
          dropped={observation.dropped}
          snapshot={displayedSnapshot}
          diagnostics={renderDiagnostics}
          onRepair={
            repairAgent ? (evidence, version) => void submitRepair(evidence, version) : undefined
          }
          repairDisabled={repairSubmitting || refreshing || repairAgent?.activity !== 'idle'}
          repairStatus={
            repair && (
              <div className='my-3 space-y-2 rounded-md border border-border p-3'>
                <p role='status'>
                  {verified
                    ? '已验证'
                    : repairedVersion
                      ? '草稿已更新 · 待复验'
                      : repairSubmitting
                        ? '正在提交修复请求…'
                        : repairRun?.status === 'completed'
                          ? '分析完成 · 请查看 Agent 结论'
                          : repairRun &&
                              ['failed', 'cancelled', 'interrupted'].includes(repairRun.status)
                            ? '修复未完成'
                            : '请在 Agent 对话查看修复进度'}
                </p>
                <p className='break-all text-muted-foreground'>
                  流程 {repair.flowId} · 节点 {repair.nodeId}
                  {verified ? ` · 复验 #${verifiedReplay?.executionId}` : ''}
                </p>
                {repairError && <ErrorToast message={repairError} />}
                <div className='flex flex-wrap gap-2'>
                  <Button
                    size='sm'
                    variant='secondary'
                    onClick={() => void changePageMode(pageId, 'chat')}
                  >
                    查看 Agent 对话
                  </Button>
                  {repairedVersion && !onRepairedSnapshot && !verified && (
                    <Button
                      size='sm'
                      variant='secondary'
                      disabled={refreshing}
                      onClick={() => void refresh()}
                    >
                      加载修复后的预览
                    </Button>
                  )}
                </div>
                {repairedVersion &&
                  displayedSnapshot &&
                  displayedSnapshot.workingVersion > repairedVersion && (
                    <p className='text-muted-foreground'>
                      草稿已有后续修改。请在当前草稿重新采集故障记录。
                    </p>
                  )}
                {onRepairedSnapshot && !verified && (
                  <p className='text-muted-foreground'>
                    请用相同输入重现交互并检查预期结果。有副作用的操作请使用测试环境或模拟请求。
                  </p>
                )}
                {replay !== undefined && !verified && displayedSnapshot && (
                  <Button
                    size='sm'
                    variant='secondary'
                    onClick={() =>
                      setVerifiedReplay({
                        evidence: repair,
                        snapshotId: displayedSnapshot.snapshotId,
                        executionId: replay,
                      })
                    }
                  >
                    确认本次结果符合预期
                  </Button>
                )}
              </div>
            )
          }
          locate={(elementId) => {
            const snapshot = currentSnapshot.current;
            if (!snapshot || !Object.hasOwn(snapshot.schema.elements, elementId)) return;
            snapshotPort.current?.postMessage({
              type: 'origamix.preview.locate',
              snapshotId: snapshot.snapshotId,
              elementId,
            });
            setShowDiagnostics(false);
          }}
        />
      )}
      {error && (
        <div className='absolute top-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-popover p-2 shadow-sm'>
          <ErrorToast
            message={`${error}。${displayedSnapshot ? '保留上次应用快照。' : '请重试。'}`}
          />
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
