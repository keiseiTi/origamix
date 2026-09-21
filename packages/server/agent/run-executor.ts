import type { MessageContent, PageIntent } from '@origamix/shared/protocol/agent';
import type { AgentRunRepository } from './run-repository';
import type { ProjectRepository } from '../projects/project-repository';
import type { AgentRunService } from './run-service';
import type { ConversationService } from '../conversations/conversation-service';
import { AgentEngineError, type AgentEngine, type AgentEngineEvent } from './engine';
import type { ContextAssembler } from './context-assembler';
import { OUT_OF_SCOPE_REPLY } from './scope-router';
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

const toolErrorText = (result: unknown): string | undefined => {
  if (!result || typeof result !== 'object') return undefined;
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return undefined;
  const text = content
    .filter((item): item is { type: 'text'; text: string } =>
      Boolean(
        item &&
        typeof item === 'object' &&
        (item as { type?: unknown }).type === 'text' &&
        typeof (item as { text?: unknown }).text === 'string',
      ),
    )
    .map((item) => item.text)
    .join('\n')
    .trim();
  return text ? text.slice(0, 500) : undefined;
};

export interface RunResult {
  runId: string;
  mode: PageIntent['mode'];
  status: 'completed' | 'failed' | 'cancelled' | 'interrupted';
  text: string;
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
  }) => RegisteredAgentTool[];
  audit?: (event: ToolAuditEvent) => void | Promise<void>;
}

export class RunExecutor {
  private readonly active = new Map<string, AbortController>();

  constructor(private readonly dependencies: RunExecutorDependencies) {}

  async execute(
    started: ReturnType<ConversationService['startRun']>,
    intent: PageIntent,
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
      return { runId, mode: intent.mode, status: 'cancelled', text: '' };
    }
    if (['completed', 'failed', 'cancelled', 'interrupted'].includes(started.run.status)) {
      return {
        runId,
        mode: intent.mode,
        status: started.run.status as RunResult['status'],
        text: '',
        ...(started.run.resultWorkingVersion
          ? { resultWorkingVersion: started.run.resultWorkingVersion }
          : {}),
      };
    }
    this.dependencies.runService.transition(runId, 'classifying');
    if (intent.mode === 'out_of_scope' || intent.mode === 'clarification_required') {
      const text = intent.mode === 'out_of_scope' ? OUT_OF_SCOPE_REPLY : intent.suggestedQuestion;
      this.dependencies.conversations.finishAssistant(runId, textContent(text));
      this.dependencies.runService.transition(runId, 'completed');
      return { runId, mode: intent.mode, status: 'completed', text };
    }

    const controller = new AbortController();
    this.active.set(runId, controller);
    const tracker = new RunBudgetController(started.run.budget);
    let assistantText = '';
    let resultWorkingVersion: number | undefined;
    let lastWriteFailure: string | undefined;
    let inputTokens = 0;
    const registry = new AgentToolRegistry();
    try {
      for (const entry of this.dependencies.createTools({
        runId,
        messageId: started.message.messageId,
        projectId: input.projectId,
        pageId: input.pageId,
        baseWorkingVersion: input.baseWorkingVersion,
      }))
        registry.register(entry);
      const audit = async (event: ToolAuditEvent): Promise<void> => {
        // The tool checks authority while the Run is tool_calling. Advance only
        // after its validation and Schema commit have actually succeeded.
        if (event.phase === 'completed' && event.toolName === 'apply_page_operations') {
          this.transitionIf(runId, 'tool_calling', 'validating');
          this.transitionIf(runId, 'validating', 'committing');
        }
        await this.dependencies.audit?.(event);
      };
      const tools = registry.toolsForRun({ runId, mode: intent.mode, budget: tracker, audit });

      this.dependencies.runService.transition(runId, 'generating');
      const assembled = await this.dependencies.context.assemble({
        page: {
          projectPath: project.path,
          pageId: page.id,
          slug: page.slug,
          relativePath: page.relativePath,
        },
        conversationId: started.conversation.id,
        intent,
        expectedWorkingVersion: input.baseWorkingVersion,
        docsQuery: intent.mode === 'page_question' ? message : undefined,
      });
      const execute = async (repair: boolean): Promise<void> => {
        tracker.consumeModelCall();
        const remainingDurationMs = Math.max(
          1,
          started.run.budget.maxDurationMs - tracker.snapshot().durationMs,
        );
        const result = await this.dependencies.engine.run({
          modelId: started.run.modelRef,
          systemPrompt: `${assembled.systemPolicy}\n\n<ORIGAMIX_CONTEXT>${JSON.stringify(assembled)}</ORIGAMIX_CONTEXT>`,
          prompt: repair
            ? [
                '上一次没有成功修改页面。请修正 Operation List，并调用 apply_page_operations；不要声称未发生的修改。',
                lastWriteFailure ? `上一次写入失败原因：${lastWriteFailure}` : undefined,
              ]
                .filter(Boolean)
                .join('\n')
            : message,
          tools,
          signal: controller.signal,
          timeoutMs: remainingDurationMs,
          onEvent: async (event) => {
            await this.handleEngineEvent(runId, event);
            if (event.type === 'text_delta') assistantText += event.delta;
            if (event.type === 'tool_end' && event.toolName === 'apply_page_operations') {
              if (event.isError) {
                lastWriteFailure = toolErrorText(event.result) ?? '写入工具未通过校验';
                return;
              }
              const result = event.result as { workingVersion?: unknown };
              if (typeof result?.workingVersion === 'number') {
                resultWorkingVersion = result.workingVersion;
              }
            }
          },
        });
        inputTokens += result.usage.inputTokens;
        tracker.recordOutputTokens(result.usage.outputTokens);
      };
      await execute(false);
      if (intent.mode === 'page_modify' && !resultWorkingVersion) {
        tracker.consumeRepair();
        await execute(true);
      }
      if (intent.mode === 'page_modify' && !resultWorkingVersion) {
        throw new AgentEngineError(
          'TOOL_ERROR',
          lastWriteFailure
            ? `页面修改未提交：${lastWriteFailure}`
            : '页面修改未提交：模型没有成功调用页面写入工具',
        );
      }
      this.dependencies.conversations.finishAssistant(
        runId,
        textContent(
          assistantText || (resultWorkingVersion ? '页面草稿已完成修改。' : '已完成回答。'),
        ),
      );
      const current = this.dependencies.runs.get(runId);
      if (resultWorkingVersion) {
        const resultPatch = { resultWorkingVersion };
        if (current?.status === 'cancelling') {
          this.dependencies.runService.transition(runId, 'completed', resultPatch);
        } else {
          this.transitionIf(runId, 'generating', 'validating');
          this.transitionIf(runId, 'tool_calling', 'validating');
          this.transitionIf(runId, 'validating', 'committing');
          this.dependencies.runService.transition(runId, 'completed', resultPatch);
        }
      } else {
        this.transitionIf(runId, 'tool_calling', 'generating');
        this.dependencies.runService.transition(runId, 'completed');
      }
      this.persistMetrics(runId, tracker, inputTokens);
      return {
        runId,
        mode: intent.mode,
        status: 'completed',
        text: assistantText,
        ...(resultWorkingVersion ? { resultWorkingVersion } : {}),
      };
    } catch (error) {
      const current = this.dependencies.runs.get(runId);
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
        mode: intent.mode,
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
    if (event.type === 'tool_start') this.transitionIf(runId, 'generating', 'tool_calling');
    if (event.type === 'tool_end' && event.toolName !== 'apply_page_operations') {
      this.transitionIf(runId, 'tool_calling', 'generating');
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
