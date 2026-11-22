import { readExecutionSteps, repairFailure } from '@/preview/runtime-repair';
import type { RuntimeObservation } from '@origamix/runtime';
import {
  getElementLabel,
  type PagePreviewReport,
  type PagePreviewSnapshot,
  type RuntimeRepairEvidence,
} from '@origamix/shared';

const statusLabels: Record<RuntimeObservation['status'], string> = {
  ready: '正常',
  degraded: '局部异常',
  failed: '失败',
  started: '运行中',
  completed: '完成',
  cancelled: '已取消',
  http_error: 'HTTP 失败',
  timeout: '超时',
  network_error: '网络或浏览器策略失败',
  configuration_error: '请求配置错误',
};

type FlowRecord = Extract<RuntimeObservation, { kind: 'flow' }>;

export const PreviewDiagnostics = ({
  records,
  diagnostics,
  snapshot,
  dropped,
  locate,
  onRepair,
  repairDisabled,
  repairStatus,
}: {
  records: RuntimeObservation[];
  diagnostics: PagePreviewReport['diagnostics'];
  snapshot: PagePreviewSnapshot | null;
  dropped: number;
  locate: (elementId: string) => void;
  onRepair?: (evidence: RuntimeRepairEvidence, workingVersion: number) => void;
  repairDisabled?: boolean;
  repairStatus?: React.ReactNode;
}) => {
  let render: Extract<RuntimeObservation, { kind: 'render' }> | undefined;
  const flows = new Map<number, FlowRecord>();
  for (const record of records) {
    if (record.kind === 'render') render = record;
    else if (record.kind === 'flow') flows.set(record.executionId, record);
  }
  const executions = [...flows.values()].reverse();
  const requests = records.filter((record) => record.kind === 'request');
  return (
    <aside
      aria-label='运行诊断'
      className='absolute inset-y-0 right-0 z-40 w-full max-w-md overflow-auto border-l border-border bg-background p-4 pt-14 text-sm text-foreground shadow-xl'
    >
      <h2 className='font-semibold'>运行诊断</h2>
      {repairStatus}
      <dl className='my-3 grid grid-cols-2 gap-2'>
        <dt>Working 版本</dt>
        <dd>{snapshot ? `v${snapshot.workingVersion}` : '—'}</dd>
        <dt>渲染状态</dt>
        <dd>{render ? statusLabels[render.status] : '等待首次渲染'}</dd>
        <dt>首次渲染耗时</dt>
        <dd>{render ? `${Math.round(render.durationMs)} ms` : '—'}</dd>
        <dt>近期流程</dt>
        <dd>
          {executions.length} 次 ·{' '}
          {executions.filter((record) => record.status === 'failed').length} 失败 ·{' '}
          {executions.filter((record) => record.status === 'cancelled').length} 取消
        </dd>
        <dt>近期请求</dt>
        <dd>
          {requests.length} 次 ·{' '}
          {requests.filter((record) => !['completed', 'cancelled'].includes(record.status)).length}{' '}
          失败 · {requests.filter((record) => record.status === 'timeout').length} 超时
        </dd>
      </dl>
      {diagnostics.length > 0 && (
        <ul aria-label='渲染异常' className='my-3 space-y-1 text-danger'>
          {diagnostics.map((entry, index) => (
            <li key={index}>
              {entry.elementId ? `${entry.elementId} · ` : ''}
              {entry.code === 'UNKNOWN_MATERIAL' ? '物料未注册' : '渲染失败'}
              {entry.elementId && (
                <button
                  type='button'
                  className='ml-2 rounded underline focus-visible:outline-2'
                  onClick={() => locate(entry.elementId!)}
                >
                  定位元素
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {dropped > 0 && (
        <p className='my-2 text-muted-foreground'>仅显示近期记录，已省略 {dropped} 条。</p>
      )}
      <h3 className='mb-2 font-semibold'>交互时间线</h3>
      {executions.length === 0 && (
        <p className='text-muted-foreground'>触发页面交互后，此处会显示流程与节点。</p>
      )}
      {executions.map((flow) => {
        const element = snapshot?.schema.elements[flow.elementId];
        const definition = snapshot?.schema.flows[flow.flowId];
        const steps = records.filter(
          (record) =>
            (record.kind === 'node' || record.kind === 'request') &&
            record.executionId === flow.executionId,
        );
        return (
          <details key={flow.executionId} className='mb-2 rounded-md border border-border p-2'>
            <summary className='cursor-pointer rounded focus-visible:outline-2'>
              {element ? getElementLabel(flow.elementId, element) : flow.elementId}
              {' · '}
              {statusLabels[flow.status]}
              {flow.status !== 'started' && ` · ${Math.round(flow.durationMs)} ms`}
            </summary>
            <p className='mt-2 break-all text-muted-foreground'>
              流程 {flow.flowId} · 元素 {flow.elementId}
              <button
                type='button'
                className='ml-2 rounded underline focus-visible:outline-2'
                onClick={() => locate(flow.elementId)}
              >
                定位触发元素
              </button>
            </p>
            <ol className='mt-2 space-y-1 border-l border-border pl-3'>
              {steps.map((step) => {
                if (step.kind !== 'node' && step.kind !== 'request') return null;
                const node = definition?.nodes[step.nodeId];
                const failure = repairFailure(step);
                const trace = failure && readExecutionSteps(records, flow, step.sequence);
                return (
                  <li key={step.sequence} className='break-all'>
                    {step.kind === 'request' ? 'HTTP 请求' : (node?.type ?? '逻辑节点')}
                    {' · '}
                    {step.nodeId}
                    {' · '}
                    {statusLabels[step.status]}
                    {step.kind === 'request' && step.statusCode ? ` · HTTP ${step.statusCode}` : ''}
                    {step.kind === 'node' && step.code ? ` · ${step.code}` : ''}
                    {' · '}
                    {Math.round(step.durationMs)} ms
                    {snapshot &&
                      onRepair &&
                      failure &&
                      trace &&
                      node &&
                      (flow.status === 'failed' || flow.status === 'completed') && (
                        <button
                          type='button'
                          disabled={repairDisabled}
                          className='ml-2 rounded underline focus-visible:outline-2 disabled:opacity-50'
                          onClick={() =>
                            onRepair(
                              {
                                type: 'runtime_repair',
                                snapshotId: snapshot.snapshotId,
                                runtimeSessionId: flow.runtimeSessionId,
                                executionId: flow.executionId,
                                workingHash: snapshot.hash,
                                flowId: flow.flowId,
                                elementId: flow.elementId,
                                nodeId: step.nodeId,
                                visited: trace
                                  .filter(
                                    (
                                      entry,
                                    ): entry is Extract<RuntimeObservation, { kind: 'node' }> =>
                                      entry.kind === 'node' &&
                                      entry.status === 'completed' &&
                                      entry.sequence < step.sequence,
                                  )
                                  .map((entry) => entry.nodeId)
                                  .slice(0, 32),
                                durationMs: Math.min(step.durationMs, 86400000),
                                failure,
                              },
                              snapshot.workingVersion,
                            )
                          }
                        >
                          交给 Agent 修复
                        </button>
                      )}
                  </li>
                );
              })}
            </ol>
          </details>
        );
      })}
    </aside>
  );
};
