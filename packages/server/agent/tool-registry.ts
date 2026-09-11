import type { RunBudget, RunMode, ToolPolicy } from '@origamix/shared/protocol/agent';
import { AgentEngineError, type AgentEngineTool } from './agent-engine';

export interface ToolAuditEvent {
  runId: string;
  toolName: string;
  phase: 'started' | 'completed' | 'failed' | 'denied';
  occurredAt: string;
  safeErrorCode?: string;
}

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
    if (tool.name === 'replace_page_schema') {
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

const writeModes = new Set<RunMode>(['page_modify']);

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
    mode: RunMode;
    budget: RunBudgetController;
    requestedToolNames?: readonly string[];
    confirmedToolNames?: readonly string[];
    audit: (event: ToolAuditEvent) => void | Promise<void>;
  }): AgentEngineTool[] {
    if (input.mode === 'out_of_scope' || input.mode === 'clarification_required') return [];
    const requested =
      input.requestedToolNames ??
      [...this.entries.values()]
        .filter((entry) => entry.policy.scope === 'read' || writeModes.has(input.mode))
        .map((entry) => entry.tool.name);
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
            safeErrorCode: 'CONFIRMATION_REQUIRED',
          }),
        ).catch(() => undefined);
        throw new AgentEngineError('POLICY_DENIED', '该工具需要用户确认后才能执行');
      }
      if (entry.policy.scope !== 'read' && !writeModes.has(input.mode)) {
        void Promise.resolve(
          input.audit({
            runId: input.runId,
            toolName: name,
            phase: 'denied',
            occurredAt: new Date().toISOString(),
            safeErrorCode: 'POLICY_DENIED',
          }),
        ).catch(() => undefined);
        throw new AgentEngineError('POLICY_DENIED', '当前对话模式不允许写入');
      }
      return {
        ...entry.tool,
        execute: async (args, signal) => {
          input.budget.consumeToolCall();
          await input.audit({
            runId: input.runId,
            toolName: name,
            phase: 'started',
            occurredAt: new Date().toISOString(),
          });
          try {
            const result = await entry.tool.execute(args, signal);
            await input.audit({
              runId: input.runId,
              toolName: name,
              phase: 'completed',
              occurredAt: new Date().toISOString(),
            });
            return result;
          } catch (error) {
            await input.audit({
              runId: input.runId,
              toolName: name,
              phase: 'failed',
              occurredAt: new Date().toISOString(),
              safeErrorCode: error instanceof AgentEngineError ? error.code : 'TOOL_ERROR',
            });
            throw error;
          }
        },
      };
    });
  }
}
