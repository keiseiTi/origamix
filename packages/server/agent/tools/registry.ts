import type { RunBudget, ToolPolicy } from '@origamix/shared/protocol/agent';
import { createHash } from 'node:crypto';
import { AgentEngineError, type AgentEngineTool } from '../engine';

export interface ToolAuditEvent {
  runId: string;
  toolName: string;
  phase: 'started' | 'completed' | 'failed' | 'denied';
  occurredAt: string;
  durationMs: number;
  safeErrorCode?: string;
  operationCount?: number;
  operationTypeCounts?: Record<string, number>;
  operationDigest?: string;
}

const operationEvidence = (toolName: string, args: unknown) => {
  if (toolName !== 'complete_page_run' || !args || typeof args !== 'object') return {};
  const operations = (args as { operations?: unknown }).operations;
  if (!Array.isArray(operations)) return {};
  const operationTypeCounts = operations.reduce<Record<string, number>>((counts, item) => {
    const type =
      item &&
      typeof item === 'object' &&
      typeof (item as { operation?: unknown }).operation === 'string'
        ? String((item as { operation: string }).operation)
        : 'unknown';
    counts[type] = (counts[type] ?? 0) + 1;
    return counts;
  }, {});
  return {
    operationCount: operations.length,
    operationTypeCounts,
    operationDigest: createHash('sha256').update(JSON.stringify(operations)).digest('hex'),
  };
};

export interface RegisteredAgentTool {
  tool: AgentEngineTool;
  policy: ToolPolicy;
}

const READ_TOOL_NAMES = new Set([
  'get_page_context',
  'get_schema_outline',
  'get_schema_fragment',
  'search_materials',
  'get_material_manifest',
  'search_product_docs',
  'validate_page_schema',
  'get_page_diagnostics',
]);

export const createDefaultAgentToolEntries = (
  tools: readonly AgentEngineTool[],
): RegisteredAgentTool[] => {
  return tools.map((tool) => {
    if (READ_TOOL_NAMES.has(tool.name)) {
      return {
        tool,
        policy: {
          toolName: tool.name,
          scope: 'read',
          risk: 'low',
          requiresConfirmation: false,
        },
      };
    }
    if (tool.name === 'complete_page_run') {
      return {
        tool,
        policy: {
          toolName: tool.name,
          scope: 'page_write',
          risk: 'low',
          requiresConfirmation: false,
        },
      };
    }
    throw new AgentEngineError('POLICY_DENIED', '工具不在领域白名单中');
  });
};

export class RunBudgetController {
  private modelCalls = 0;
  private toolCalls = 0;
  private outputTokens = 0;
  private repairAttempts = 0;
  private readonly startedAt = Date.now();

  constructor(readonly budget: RunBudget) {}

  consumeModelCall(): void {
    this.assertDuration();
    this.modelCalls += 1;
    if (this.modelCalls > this.budget.maxModelCalls) this.exceeded('模型调用次数');
  }

  consumeToolCall(): void {
    this.assertDuration();
    this.toolCalls += 1;
    if (this.toolCalls > this.budget.maxToolCalls) this.exceeded('工具调用次数');
  }

  recordOutputTokens(tokens: number): void {
    this.outputTokens += Math.max(0, tokens);
    if (this.outputTokens > this.budget.maxOutputTokens) this.exceeded('输出 Token');
  }

  assertSchemaSize(schema: unknown): void {
    const bytes = Buffer.byteLength(JSON.stringify(schema), 'utf8');
    if (bytes > this.budget.maxSchemaBytes) this.exceeded('Schema 大小');
  }

  consumeRepair(): void {
    this.repairAttempts += 1;
    if (this.repairAttempts > this.budget.maxRepairAttempts) this.exceeded('Schema 修复次数');
  }

  assertDuration(): void {
    if (Date.now() - this.startedAt > this.budget.maxDurationMs) this.exceeded('运行时长');
  }

  snapshot() {
    return {
      modelCalls: this.modelCalls,
      toolCalls: this.toolCalls,
      outputTokens: this.outputTokens,
      repairAttempts: this.repairAttempts,
      durationMs: Date.now() - this.startedAt,
    };
  }

  private exceeded(subject: string): never {
    throw new AgentEngineError('BUDGET_EXCEEDED', `${subject}已超过本次运行预算`);
  }
}

export class AgentToolRegistry {
  private readonly entries = new Map<string, RegisteredAgentTool>();

  register(entry: RegisteredAgentTool): void {
    if (this.entries.has(entry.tool.name)) throw new Error(`工具已注册：${entry.tool.name}`);
    if (entry.policy.toolName !== entry.tool.name) throw new Error('工具策略名称不匹配');
    this.entries.set(entry.tool.name, entry);
  }

  toolsForRun(input: {
    runId: string;
    budget: RunBudgetController;
    requestedToolNames?: readonly string[];
    confirmedToolNames?: readonly string[];
    audit: (event: ToolAuditEvent) => void | Promise<void>;
  }): AgentEngineTool[] {
    let terminalAccepted = false;
    const requested =
      input.requestedToolNames ?? [...this.entries.values()].map((entry) => entry.tool.name);
    return requested.map((name) => {
      const entry = this.entries.get(name);
      if (!entry) throw new AgentEngineError('POLICY_DENIED', '请求包含未授权工具');
      if (entry.policy.requiresConfirmation && !input.confirmedToolNames?.includes(name)) {
        void Promise.resolve(
          input.audit({
            runId: input.runId,
            toolName: name,
            phase: 'denied',
            occurredAt: new Date().toISOString(),
            durationMs: 0,
            safeErrorCode: 'CONFIRMATION_REQUIRED',
          }),
        ).catch(() => undefined);
        throw new AgentEngineError('POLICY_DENIED', '该工具需要用户确认后才能执行');
      }
      return {
        ...entry.tool,
        execute: async (args, signal) => {
          if (terminalAccepted) {
            throw new AgentEngineError('POLICY_DENIED', 'Agent Run 已提交终态');
          }
          input.budget.consumeToolCall();
          const startedAt = Date.now();
          const evidence = operationEvidence(name, args);
          await input.audit({
            runId: input.runId,
            toolName: name,
            phase: 'started',
            occurredAt: new Date().toISOString(),
            durationMs: 0,
            ...evidence,
          });
          try {
            const result = await entry.tool.execute(args, signal);
            if (name === 'complete_page_run') terminalAccepted = true;
            await input.audit({
              runId: input.runId,
              toolName: name,
              phase: 'completed',
              occurredAt: new Date().toISOString(),
              durationMs: Date.now() - startedAt,
              ...evidence,
            });
            return result;
          } catch (error) {
            await input.audit({
              runId: input.runId,
              toolName: name,
              phase: 'failed',
              occurredAt: new Date().toISOString(),
              durationMs: Date.now() - startedAt,
              safeErrorCode: error instanceof AgentEngineError ? error.code : 'TOOL_ERROR',
              ...evidence,
            });
            throw error;
          }
        },
      };
    });
  }
}
