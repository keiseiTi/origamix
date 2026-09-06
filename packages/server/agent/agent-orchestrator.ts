import type { MessageContent, PageIntent, RunBudget } from '@origamix/shared/protocol/agent';
import type { AgentRunRepository } from '../repositories/agent-run-repository';
import type { ProjectRepository } from '../repositories/project-repository';
import type { AgentRunService } from '../services/agent-run-service';
import type { ConversationService } from '../services/conversation-service';
import { AgentEngineError, type AgentEngine, type AgentEngineEvent } from './agent-engine';
import type { ContextAssembler } from './context-assembler';
import { OUT_OF_SCOPE_REPLY, type ScopeRouter } from './scope-router';
import {
  AgentToolRegistry,
  RunBudgetController,
  type RegisteredAgentTool,
  type ToolAuditEvent,
} from './tool-registry';

const textContent = (text: string): MessageContent => ({
  version: '1',
  blocks: [{ type: 'text', text }],
});

export interface AgentOrchestratorInput {
  projectId: string;
  pageId: string;
  clientRequestId: string;
  baseRevisionId: string;
  message: string;
  conversationId?: string;
  retryOfRunId?: string;
}

export interface AgentOrchestratorResult {
  runId: string;
  mode: PageIntent['mode'];
  status: 'completed' | 'failed' | 'cancelled';
  text: string;
  resultRevisionId?: string;
}

export interface AgentOrchestratorDependencies {
  projects: ProjectRepository;
  runs: AgentRunRepository;
  conversations: ConversationService;
  runService: AgentRunService;
  router: ScopeRouter;
  context: ContextAssembler;
  engine: AgentEngine;
  createTools: (input: {
    runId: string;
    messageId: string;
    projectId: string;
    pageId: string;
    baseRevisionId: string;
  }) => RegisteredAgentTool[];
  audit?: (event: ToolAuditEvent) => void | Promise<void>;
  budget?: RunBudget;
}

const DEFAULT_BUDGET: RunBudget = {
  maxModelCalls: 6,
  maxToolCalls: 12,
  maxOutputTokens: 16_000,
  maxDurationMs: 120_000,
  maxSchemaBytes: 256 * 1024,
  maxRepairAttempts: 1,
};

export class AgentRunOrchestrator {
  private readonly active = new Map<string, AbortController>();

  constructor(private readonly dependencies: AgentOrchestratorDependencies) {}

  async run(input: AgentOrchestratorInput): Promise<AgentOrchestratorResult> {
    const project = this.dependencies.projects.getProject(input.projectId);
    const page = this.dependencies.projects.getPage(input.projectId, input.pageId);
    if (!project || !page) throw new Error('页面不存在或不属于当前项目');
    const intent = await this.dependencies.router.route(input.message, input.pageId);
    const started = this.dependencies.conversations.startRun({
      ...input,
      content: textContent(input.message),
      modelRef: 'deepseek/deepseek-v4-flash',
      mode: intent.mode,
      budget: this.dependencies.budget ?? DEFAULT_BUDGET,
      promptVersion: '1',
      policyVersion: '1',
      toolsetVersion: '1',
      materialManifestVersion: 'official-antd@1.0.0',
    });
    const runId = started.run.id;
    if (['completed', 'failed', 'cancelled'].includes(started.run.status)) {
      return {
        runId,
        mode: intent.mode,
        status: started.run.status as AgentOrchestratorResult['status'],
        text: '',
        ...(started.run.resultRevisionId ? { resultRevisionId: started.run.resultRevisionId } : {}),
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
    let resultRevisionId: string | undefined;
    let inputTokens = 0;
    const registry = new AgentToolRegistry();
    for (const entry of this.dependencies.createTools({
      runId,
      messageId: started.message.messageId,
      projectId: input.projectId,
      pageId: input.pageId,
      baseRevisionId: input.baseRevisionId,
    }))
      registry.register(entry);
    const audit = async (event: ToolAuditEvent): Promise<void> => {
      if (event.phase === 'started' && event.toolName === 'replace_page_schema') {
        this.transitionIf(runId, 'tool_calling', 'validating');
        this.transitionIf(runId, 'validating', 'committing');
      }
      await this.dependencies.audit?.(event);
    };
    const tools = registry.toolsForRun({ runId, mode: intent.mode, budget: tracker, audit });

    try {
      this.dependencies.runService.transition(runId, 'generating');
      const assembled = await this.dependencies.context.assemble({
        page: { projectPath: project.path, pageId: page.id, slug: page.slug },
        conversationId: started.conversation.id,
        intent,
        expectedBaseRevisionId: input.baseRevisionId,
        docsQuery: intent.mode === 'page_question' ? input.message : undefined,
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
            ? '上一次没有成功提交页面。请修正候选 Schema，并调用 replace_page_schema；不要声称未发生的修改。'
            : input.message,
          tools,
          signal: controller.signal,
          timeoutMs: remainingDurationMs,
          onEvent: async (event) => {
            await this.handleEngineEvent(runId, event);
            if (event.type === 'text_delta') assistantText += event.delta;
            if (
              event.type === 'tool_end' &&
              !event.isError &&
              event.toolName === 'replace_page_schema'
            ) {
              const result = event.result as { revisionId?: unknown };
              if (typeof result?.revisionId === 'string') resultRevisionId = result.revisionId;
            }
          },
        });
        inputTokens += result.usage.inputTokens;
        tracker.recordOutputTokens(result.usage.outputTokens);
      };
      await execute(false);
      if (intent.mode === 'page_modify' && !resultRevisionId) {
        tracker.consumeRepair();
        await execute(true);
      }
      if (intent.mode === 'page_modify' && !resultRevisionId) {
        throw new AgentEngineError('TOOL_ERROR', '页面修改未产生有效提交');
      }
      this.dependencies.conversations.finishAssistant(
        runId,
        textContent(assistantText || (resultRevisionId ? '页面已完成修改。' : '已完成回答。')),
      );
      const current = this.dependencies.runs.get(runId);
      if (resultRevisionId) {
        if (current?.status === 'cancelling') {
          this.dependencies.runService.transition(runId, 'completed', { resultRevisionId });
        } else {
          this.transitionIf(runId, 'generating', 'validating');
          this.transitionIf(runId, 'tool_calling', 'validating');
          this.transitionIf(runId, 'validating', 'committing');
          this.dependencies.runService.transition(runId, 'completed', { resultRevisionId });
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
        ...(resultRevisionId ? { resultRevisionId } : {}),
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
      this.dependencies.conversations.failAssistant(
        runId,
        textContent('本次请求未完成，请重试。'),
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
    this.dependencies.runService.cancel(runId);
    this.active.get(runId)?.abort();
  }

  private async handleEngineEvent(runId: string, event: AgentEngineEvent): Promise<void> {
    if (event.type === 'tool_start') this.transitionIf(runId, 'generating', 'tool_calling');
    if (event.type === 'tool_end' && event.toolName !== 'replace_page_schema') {
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
