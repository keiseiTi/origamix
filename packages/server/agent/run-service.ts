import type { AgentRunStatus } from '@origamix/shared/protocol/agent';
import { conflict, notFound } from '../errors';
import { AgentRunRepository, type AgentRunRecord } from './run-repository';

const terminal = new Set<AgentRunStatus>(['completed', 'failed', 'cancelled', 'interrupted']);
const active: AgentRunStatus[] = [
  'queued',
  'classifying',
  'generating',
  'tool_calling',
  'validating',
  'committing',
  'awaiting_confirmation',
  'cancelling',
];

const transitions: Record<AgentRunStatus, readonly AgentRunStatus[]> = {
  queued: ['classifying', 'cancelling', 'failed', 'interrupted'],
  classifying: ['generating', 'completed', 'cancelling', 'failed', 'interrupted'],
  generating: [
    'tool_calling',
    'validating',
    'completed',
    'awaiting_confirmation',
    'cancelling',
    'failed',
    'interrupted',
  ],
  tool_calling: [
    'generating',
    'validating',
    'awaiting_confirmation',
    'cancelling',
    'failed',
    'interrupted',
  ],
  validating: ['generating', 'committing', 'cancelling', 'failed', 'interrupted'],
  committing: ['completed', 'cancelling', 'failed', 'interrupted'],
  awaiting_confirmation: [
    'generating',
    'tool_calling',
    'validating',
    'cancelling',
    'cancelled',
    'failed',
    'interrupted',
  ],
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
  constructor(private readonly runs: AgentRunRepository) {}

  get(runId: string): AgentRunRecord {
    return this.require(runId);
  }

  transition(
    runId: string,
    status: AgentRunStatus,
    patch: {
      resultRevisionId?: string;
      resultWorkingVersion?: number;
      errorCode?: string;
      errorMessage?: string;
      durationMs?: number;
    } = {},
  ): AgentRunRecord {
    const current = this.require(runId);
    if (current.status === status && terminal.has(status)) return current;
    if (!canTransitionAgentRun(current.status, status)) {
      throw conflict(`Agent Run 不能从 ${current.status} 转换到 ${status}`);
    }
    if (
      status === 'completed' &&
      !(patch.resultWorkingVersion ?? current.resultWorkingVersion) &&
      current.mode === 'page_modify'
    ) {
      throw conflict('页面修改 Run 完成前必须关联 Working 版本');
    }
    const timestamp = new Date().toISOString();
    const changed = this.runs.updateStatus(runId, [current.status], {
      status,
      updatedAt: timestamp,
      ...(terminal.has(status) ? { finishedAt: timestamp } : {}),
      ...patch,
      ...(patch.errorMessage ? { errorMessage: redactSafeMessage(patch.errorMessage) } : {}),
    });
    if (!changed) {
      const raced = this.require(runId);
      if (raced.status === status && terminal.has(status)) return raced;
      throw conflict(`Agent Run 状态已从 ${current.status} 变化`);
    }
    return this.require(runId);
  }

  cancel(runId: string): AgentRunRecord {
    const current = this.require(runId);
    if (current.status === 'cancelled' || current.status === 'cancelling') return current;
    if (terminal.has(current.status)) return current;
    const changed = this.runs.updateStatus(runId, [current.status], {
      status: 'cancelling',
      updatedAt: new Date().toISOString(),
    });
    if (changed) return this.require(runId);
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
    isRevisionCommitted: (run: AgentRunRecord) => boolean | Promise<boolean>,
  ): Promise<AgentRunRecord[]> {
    const recovered: AgentRunRecord[] = [];
    for (const run of this.runs.listActive()) {
      if (run.resultRevisionId && (await isRevisionCommitted(run))) {
        const timestamp = new Date().toISOString();
        this.runs.updateStatus(run.id, active, {
          status: 'completed',
          updatedAt: timestamp,
          finishedAt: timestamp,
        });
      } else {
        const timestamp = new Date().toISOString();
        this.runs.updateStatus(run.id, active, {
          status: 'interrupted',
          updatedAt: timestamp,
          finishedAt: timestamp,
          errorCode: 'PROCESS_INTERRUPTED',
          errorMessage: '运行被进程重启中断，可由用户发起重试。',
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
