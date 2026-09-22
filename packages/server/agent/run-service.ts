import type { AgentRunStatus, PageAgentOutcome } from '@origamix/shared/protocol/agent';
import { conflict, notFound } from '../errors';
import { AgentRunRepository, type AgentRunRecord } from './run-repository';

const terminal = new Set<AgentRunStatus>(['completed', 'failed', 'cancelled', 'interrupted']);
const active: AgentRunStatus[] = [
  'queued',
  'preparing',
  'reasoning',
  'reading',
  'validating',
  'repairing',
  'committing',
  'deciding',
  'cancelling',
];

const transitions: Record<AgentRunStatus, readonly AgentRunStatus[]> = {
  queued: ['preparing', 'cancelling', 'failed', 'interrupted'],
  preparing: ['reasoning', 'cancelling', 'failed', 'interrupted'],
  reasoning: ['reading', 'deciding', 'cancelling', 'failed', 'interrupted'],
  reading: ['reasoning', 'deciding', 'cancelling', 'failed', 'interrupted'],
  deciding: ['validating', 'completed', 'cancelling', 'failed', 'interrupted'],
  validating: ['repairing', 'committing', 'cancelling', 'failed', 'interrupted'],
  repairing: ['deciding', 'cancelling', 'failed', 'interrupted'],
  committing: ['completed', 'failed', 'interrupted'],
  cancelling: ['cancelled', 'completed', 'failed', 'interrupted'],
  completed: [],
  failed: [],
  cancelled: [],
  interrupted: [],
};

export const canTransitionAgentRun = (from: AgentRunStatus, to: AgentRunStatus): boolean => {
  return transitions[from].includes(to);
};

const redactSafeMessage = (message: string | undefined): string | undefined => {
  if (!message) return undefined;
  return message
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\b(api[_-]?key|token|secret|authorization)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .slice(0, 2_000);
};

export class AgentRunService {
  private transitionListener?: (run: AgentRunRecord) => void;

  constructor(private readonly runs: AgentRunRepository) {}

  setTransitionListener(listener: (run: AgentRunRecord) => void): void {
    this.transitionListener = listener;
  }

  get(runId: string): AgentRunRecord {
    return this.require(runId);
  }

  transition(
    runId: string,
    status: AgentRunStatus,
    patch: {
      resultWorkingVersion?: number;
      resultWorkingHash?: string;
      errorCode?: string;
      errorMessage?: string;
      durationMs?: number;
      outcome?: PageAgentOutcome;
      outcomeJson?: unknown;
      repairAttempts?: number;
      operationCount?: number;
      operationDigest?: string;
      failureStage?: string;
      recoveredCommit?: boolean;
    } = {},
  ): AgentRunRecord {
    const current = this.require(runId);
    if (current.status === status && terminal.has(status)) return current;
    if (!canTransitionAgentRun(current.status, status)) {
      throw conflict(`Agent Run 不能从 ${current.status} 转换到 ${status}`);
    }
    const timestamp = new Date().toISOString();
    const changed = this.runs.updateStatus(runId, [current.status], {
      status,
      updatedAt: timestamp,
      ...(terminal.has(status) ? { finishedAt: timestamp } : {}),
      ...(status === 'failed' || status === 'interrupted' ? { failureStage: current.status } : {}),
      ...patch,
      ...(patch.errorMessage ? { errorMessage: redactSafeMessage(patch.errorMessage) } : {}),
    });
    if (!changed) {
      const raced = this.require(runId);
      if (raced.status === status && terminal.has(status)) return raced;
      throw conflict(`Agent Run 状态已从 ${current.status} 变化`);
    }
    const next = this.require(runId);
    this.transitionListener?.(next);
    return next;
  }

  recordWorkingCommit(
    runId: string,
    resultWorkingVersion: number,
    resultWorkingHash: string,
  ): AgentRunRecord {
    const current = this.require(runId);
    if (
      current.resultWorkingVersion === resultWorkingVersion &&
      current.resultWorkingHash === resultWorkingHash
    )
      return current;
    if (terminal.has(current.status))
      throw conflict('已结束的 Agent Run 不能记录新的 Working 版本');
    const changed = this.runs.updateStatus(runId, [current.status], {
      status: current.status,
      resultWorkingVersion,
      resultWorkingHash,
      updatedAt: new Date().toISOString(),
    });
    if (!changed) throw conflict(`Agent Run 状态已从 ${current.status} 变化`);
    return this.require(runId);
  }

  cancel(runId: string): AgentRunRecord {
    const current = this.require(runId);
    if (current.status === 'cancelled' || current.status === 'cancelling') return current;
    // `committing` means the Working replacement has crossed its durable commit point.
    // Cancellation can no longer truthfully report an unmodified page.
    if (current.status === 'committing') return current;
    if (terminal.has(current.status)) return current;
    const changed = this.runs.updateStatus(runId, [current.status], {
      status: 'cancelling',
      updatedAt: new Date().toISOString(),
    });
    if (changed) {
      const next = this.require(runId);
      this.transitionListener?.(next);
      return next;
    }
    const raced = this.require(runId);
    if (terminal.has(raced.status) || raced.status === 'cancelling') return raced;
    throw conflict(`Agent Run 状态已从 ${current.status} 变化`);
  }

  findByClientRequest(
    projectId: string,
    pageId: string,
    clientRequestId: string,
  ): AgentRunRecord | undefined {
    return this.runs.findByClientRequest(projectId, pageId, clientRequestId);
  }

  async recover(
    inspectCommit: (
      run: AgentRunRecord,
    ) =>
      | { disposition: 'committed'; resultWorkingVersion: number; resultWorkingHash: string }
      | { disposition: 'not_committed' | 'conflict' }
      | Promise<
          | { disposition: 'committed'; resultWorkingVersion: number; resultWorkingHash: string }
          | { disposition: 'not_committed' | 'conflict' }
        >,
  ): Promise<AgentRunRecord[]> {
    const recovered: AgentRunRecord[] = [];
    for (const run of this.runs.listActive()) {
      const inspection = await inspectCommit(run);
      if (inspection.disposition === 'committed') {
        const timestamp = new Date().toISOString();
        this.runs.updateStatus(run.id, active, {
          status: 'completed',
          updatedAt: timestamp,
          finishedAt: timestamp,
          outcome: run.outcome ?? 'changed',
          resultWorkingVersion: inspection.resultWorkingVersion,
          resultWorkingHash: inspection.resultWorkingHash,
          recoveredCommit: true,
        });
      } else if (inspection.disposition === 'conflict') {
        const timestamp = new Date().toISOString();
        this.runs.updateStatus(run.id, active, {
          status: 'failed',
          updatedAt: timestamp,
          finishedAt: timestamp,
          errorCode: 'AGENT_COMMIT_RECOVERY_CONFLICT',
          errorMessage: 'Agent 提交回执与当前 Working Schema 不一致，未自动重放修改。',
          failureStage: run.status,
        });
      } else {
        const timestamp = new Date().toISOString();
        this.runs.updateStatus(run.id, active, {
          status: 'interrupted',
          updatedAt: timestamp,
          finishedAt: timestamp,
          errorCode: 'PROCESS_INTERRUPTED',
          errorMessage: '运行被进程重启中断，可由用户发起重试。',
          failureStage: run.status,
        });
      }
      recovered.push(this.require(run.id));
    }
    return recovered;
  }

  private require(id: string): AgentRunRecord {
    const run = this.runs.get(id);
    if (!run) throw notFound('Agent Run 不存在');
    return run;
  }
}
