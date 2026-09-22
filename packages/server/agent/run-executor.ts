import type { MessageContent, PageAgentOutcome } from '@origamix/shared/protocol/agent';
import type { AgentRunRepository } from './run-repository';
import type { ProjectRepository } from '../projects/project-repository';
import type { AgentRunService } from './run-service';
import type { ConversationService } from '../conversations/conversation-service';
import { AgentEngineError, type AgentEngine, type AgentEngineEvent } from './engine';
import type { ContextAssembler } from './context-assembler';
import {
  AgentToolRegistry,
  RunBudgetController,
  type RegisteredAgentTool,
  type ToolAuditEvent,
} from './tools/registry';

const textContent = (text: string): MessageContent => ({
  version: '1',
  blocks: [{ type: 'text', text }],
});

const safeToolError = (result: unknown): string => {
  const serialized = (() => {
    try {
      return JSON.stringify(result);
    } catch {
      return '';
    }
  })();
  return serialized.slice(0, 1_500) || 'Operation 校验失败';
};

export interface RunResult {
  runId: string;
  status: 'completed' | 'failed' | 'cancelled' | 'interrupted';
  text: string;
  outcome?: PageAgentOutcome;
  resultWorkingVersion?: number;
}

export interface RunExecutorDependencies {
  projects: ProjectRepository;
  runs: AgentRunRepository;
  conversations: ConversationService;
  runService: AgentRunService;
  context: ContextAssembler;
  engine: AgentEngine;
  createTools: (input: {
    runId: string;
    messageId: string;
    projectId: string;
    pageId: string;
    baseWorkingVersion: number;
    maxSchemaBytes: number;
    maxRepairAttempts: number;
  }) => RegisteredAgentTool[];
  audit?: (event: ToolAuditEvent) => void | Promise<void>;
}

export class RunExecutor {
  private readonly active = new Map<string, AbortController>();

  constructor(private readonly dependencies: RunExecutorDependencies) {}

  async execute(
    started: ReturnType<ConversationService['startRun']>,
    message: string,
  ): Promise<RunResult> {
    const input = started.run;
    const project = this.dependencies.projects.getProject(input.projectId);
    const page = this.dependencies.projects.getPage(input.projectId, input.pageId);
    if (!project || !page) throw new Error('页面不存在或不属于当前项目');
    const runId = started.run.id;
    const currentBeforeStart = this.dependencies.runs.get(runId);
    if (currentBeforeStart?.status === 'cancelling') {
      this.dependencies.runService.transition(runId, 'cancelled');
      this.dependencies.conversations.failAssistant(
        runId,
        textContent('本次请求已取消。'),
        'CANCELLED',
      );
      return { runId, status: 'cancelled', text: '' };
    }
    if (['completed', 'failed', 'cancelled', 'interrupted'].includes(started.run.status)) {
      return {
        runId,
        status: started.run.status as RunResult['status'],
        text: '',
        ...(started.run.resultWorkingVersion
          ? { resultWorkingVersion: started.run.resultWorkingVersion }
          : {}),
      };
    }
    this.dependencies.runService.transition(runId, 'preparing');
    const controller = new AbortController();
    this.active.set(runId, controller);
    const tracker = new RunBudgetController(started.run.budget);
    let assistantText = '';
    let resultWorkingVersion: number | undefined;
    let terminalOutcome: PageAgentOutcome | undefined;
    let terminalFailure: string | undefined;
    let inputTokens = 0;
    const registry = new AgentToolRegistry();
    try {
      for (const entry of this.dependencies.createTools({
        runId,
        messageId: started.message.messageId,
        projectId: input.projectId,
        pageId: input.pageId,
        baseWorkingVersion: input.baseWorkingVersion,
        maxSchemaBytes: input.budget.maxSchemaBytes,
        maxRepairAttempts: input.budget.maxRepairAttempts,
      }))
        registry.register(entry);
      const audit = async (event: ToolAuditEvent): Promise<void> => {
        await this.dependencies.audit?.(event);
      };
      const tools = registry.toolsForRun({ runId, budget: tracker, audit });

      this.dependencies.runService.transition(runId, 'reasoning');
      const assembled = await this.dependencies.context.assemble({
        page: {
          projectPath: project.path,
          pageId: page.id,
          slug: page.slug,
          relativePath: page.relativePath,
        },
        conversationId: started.conversation.id,
        currentRequest: message,
        expectedWorkingVersion: input.baseWorkingVersion,
      });
      let prompt = message;
      let missingTerminalRepairUsed = false;
      while (!terminalOutcome) {
        tracker.consumeModelCall();
        const remainingDurationMs = Math.max(
          1,
          started.run.budget.maxDurationMs - tracker.snapshot().durationMs,
        );
        terminalFailure = undefined;
        const result = await this.dependencies.engine.run({
          modelId: started.run.modelRef,
          systemPrompt: `${assembled.systemPolicy}\n\n<ORIGAMIX_CONTEXT>${JSON.stringify(assembled)}</ORIGAMIX_CONTEXT>`,
          prompt,
          tools,
          signal: controller.signal,
          timeoutMs: remainingDurationMs,
          onEvent: async (event) => {
            await this.handleEngineEvent(runId, event);
            if (event.type === 'tool_end' && event.toolName === 'complete_page_run') {
              if (event.isError) {
                terminalFailure = safeToolError(event.result);
                return;
              }
              const terminal = event.result as {
                accepted?: unknown;
                outcome?: unknown;
                response?: unknown;
                resultWorkingVersion?: unknown;
              };
              if (terminal.accepted === true && typeof terminal.outcome === 'string') {
                terminalOutcome = terminal.outcome as PageAgentOutcome;
                if (typeof terminal.response === 'string') assistantText = terminal.response;
                if (typeof terminal.resultWorkingVersion === 'number') {
                  resultWorkingVersion = terminal.resultWorkingVersion;
                }
              }
            }
          },
        });
        inputTokens += result.usage.inputTokens;
        tracker.recordOutputTokens(result.usage.outputTokens);
        if (terminalOutcome) break;

        const current = this.dependencies.runs.get(runId);
        if (current?.status === 'repairing') {
          if (current.repairAttempts > started.run.budget.maxRepairAttempts) {
            throw new AgentEngineError(
              'SCHEMA_VALIDATION_EXCEEDED',
              '页面修改校验失败，已超过允许的修复次数',
            );
          }
          tracker.consumeRepair();
          prompt = [
            '上一次完整 Operation List 未通过服务端校验。',
            `结构化错误：${JSON.stringify({ code: 'OPERATION_VALIDATION_FAILED', message: terminalFailure ?? 'Operation 校验失败' })}`,
            '只修正错误指出的参数，但仍须通过 complete_page_run 针对原始 base Working Version 提交完整 operations 数组。',
          ].join('\n');
          continue;
        }
        if (current?.status === 'validating') {
          throw new AgentEngineError(
            'WORKING_VERSION_CONFLICT',
            '页面草稿已变化，本次修改不能自动重试',
          );
        }
        if (missingTerminalRepairUsed) {
          throw new AgentEngineError(
            'MISSING_TERMINAL_DECISION',
            '模型在协议修复后仍未提交 complete_page_run',
          );
        }
        missingTerminalRepairUsed = true;
        prompt =
          '协议修复：你必须调用 complete_page_run 提交一个结构化终态。不要输出自由文本作为最终答案，也不要省略终态工具。';
      }
      this.dependencies.conversations.finishAssistant(runId, textContent(assistantText));
      const current = this.dependencies.runs.get(runId);
      if (resultWorkingVersion) {
        const resultPatch = { resultWorkingVersion };
        if (current?.status === 'cancelling') {
          this.dependencies.runService.transition(runId, 'completed', resultPatch);
        } else {
          this.dependencies.runService.transition(runId, 'completed', resultPatch);
        }
      } else {
        this.dependencies.runService.transition(runId, 'completed');
      }
      this.persistMetrics(runId, tracker, inputTokens);
      return {
        runId,
        status: 'completed',
        text: assistantText,
        outcome: terminalOutcome,
        ...(resultWorkingVersion ? { resultWorkingVersion } : {}),
      };
    } catch (error) {
      const current = this.dependencies.runs.get(runId);
      const committedWorkingVersion = current?.resultWorkingVersion ?? resultWorkingVersion;
      if (current?.status === 'deciding' && current.outcome && assistantText) {
        this.dependencies.conversations.finishAssistant(runId, textContent(assistantText));
        this.dependencies.runService.transition(runId, 'completed');
        this.persistMetrics(runId, tracker, inputTokens);
        return {
          runId,
          status: 'completed',
          text: assistantText,
          outcome: current.outcome,
        };
      }
      if (
        committedWorkingVersion &&
        current &&
        !['completed', 'failed', 'cancelled', 'interrupted'].includes(current.status)
      ) {
        this.dependencies.conversations.finishAssistant(
          runId,
          textContent(assistantText || '页面草稿已完成修改。'),
        );
        this.dependencies.runService.transition(runId, 'completed', {
          resultWorkingVersion: committedWorkingVersion,
        });
        this.persistMetrics(runId, tracker, inputTokens);
        return {
          runId,
          status: 'completed',
          text: assistantText,
          resultWorkingVersion: committedWorkingVersion,
        };
      }
      const cancelled =
        controller.signal.aborted ||
        (error instanceof AgentEngineError && error.code === 'CANCELLED');
      if (cancelled && current?.status === 'cancelling') {
        this.dependencies.runService.transition(runId, 'cancelled');
      } else if (
        current &&
        !['completed', 'failed', 'cancelled', 'interrupted'].includes(current.status)
      ) {
        this.dependencies.runService.transition(runId, 'failed', {
          errorCode: error instanceof AgentEngineError ? error.code : 'INTERNAL_ERROR',
          errorMessage: error instanceof Error ? error.message : 'Agent 运行失败',
        });
      }
      const safeFailure =
        error instanceof AgentEngineError ? error.message : 'Agent 运行失败，请重试。';
      this.dependencies.conversations.failAssistant(
        runId,
        textContent(`本次请求未完成：${safeFailure}`),
        'AGENT_FAILED',
      );
      this.persistMetrics(runId, tracker, inputTokens);
      return {
        runId,
        status: cancelled ? 'cancelled' : 'failed',
        text: assistantText,
      };
    } finally {
      this.active.delete(runId);
    }
  }

  cancel(runId: string): void {
    this.active.get(runId)?.abort();
  }

  private async handleEngineEvent(runId: string, event: AgentEngineEvent): Promise<void> {
    if (event.type === 'tool_start') this.transitionIf(runId, 'reasoning', 'reading');
    if (event.type === 'tool_end' && event.toolName !== 'complete_page_run') {
      this.transitionIf(runId, 'reading', 'reasoning');
    }
  }

  private transitionIf(
    runId: string,
    expected: string,
    target: Parameters<AgentRunService['transition']>[1],
  ): void {
    if (this.dependencies.runs.get(runId)?.status === expected) {
      this.dependencies.runService.transition(runId, target);
    }
  }

  private persistMetrics(runId: string, tracker: RunBudgetController, inputTokens: number): void {
    const metrics = tracker.snapshot();
    this.dependencies.runs.updateMetrics(runId, {
      inputTokens,
      outputTokens: metrics.outputTokens,
      modelCalls: metrics.modelCalls,
      toolCalls: metrics.toolCalls,
      durationMs: metrics.durationMs,
    });
  }
}
