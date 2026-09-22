import { createHash, randomUUID } from 'node:crypto';
import { Value } from '@sinclair/typebox/value';
import {
  CompletePageRunInputSchema,
  type CompletePageRunInput,
  type PageAgentOutcome,
} from '@origamix/shared/protocol/agent';
import type { SchemaOperation } from '@origamix/shared/protocol/schema';
import type { AgentRunRepository } from '../run-repository';
import type { AgentRunService } from '../run-service';
import type { ProjectRepository } from '../../projects/project-repository';
import { ApiError, conflict, invalid, notFound } from '../../errors';
import { applyWorkingSchemaOperations, getWorkingSchemaState } from '../../schema/schema-service';
import { AgentEngineError, type AgentEngineTool } from '../engine';

export interface CompletePageRunToolScope {
  runId: string;
  messageId: string;
  projectId: string;
  pageId: string;
  baseWorkingVersion: number;
  maxSchemaBytes: number;
  maxRepairAttempts: number;
}

export interface CompletePageRunToolDependencies {
  projects: Pick<ProjectRepository, 'getProject' | 'getPage'>;
  runs: Pick<AgentRunRepository, 'get'>;
  runService: AgentRunService;
}

export interface CompletePageRunResult {
  accepted: true;
  outcome: PageAgentOutcome;
  response: string;
  resultWorkingVersion?: number;
}

const assertNotCancelled = (signal: AbortSignal): void => {
  if (signal.aborted) throw new AgentEngineError('CANCELLED', '页面请求已取消');
};

const operationDigest = (operations: readonly SchemaOperation[]): string =>
  createHash('sha256').update(JSON.stringify(operations)).digest('hex');

const terminalOutcome = (input: CompletePageRunInput): PageAgentOutcome => {
  if (input.outcome === 'apply_changes')
    return input.answeredQuestion ? 'changed_and_answered' : 'changed';
  if (input.outcome === 'answer_only') return 'answered_only';
  return input.outcome;
};

const terminalResponse = (input: CompletePageRunInput): string =>
  input.outcome === 'needs_clarification' ? input.question : input.response;

/**
 * Creates the sole model-visible terminal decision for a Page Agent Run.
 * All authority is captured by the Server; model input contains only the decision payload.
 */
export const createCompletePageRunTool = (
  dependencies: CompletePageRunToolDependencies,
  scope: CompletePageRunToolScope,
): AgentEngineTool => ({
  name: 'complete_page_run',
  description:
    '结束当前页面请求。每个 Run 必须且只能成功调用一次。需要修改时提交完整 operations 和最终回复；只回答、无需修改、需要澄清或拒绝时提交对应 outcome。',
  parameters: CompletePageRunInputSchema,
  execute: async (raw, signal) => {
    if (!Value.Check(CompletePageRunInputSchema, raw)) {
      throw invalid('complete_page_run 参数无效');
    }
    assertNotCancelled(signal);
    const input = raw as CompletePageRunInput;
    const run = dependencies.runs.get(scope.runId);
    if (!run) throw notFound('Agent Run 不存在');
    if (
      run.projectId !== scope.projectId ||
      run.pageId !== scope.pageId ||
      run.userMessageId !== scope.messageId ||
      run.baseWorkingVersion !== scope.baseWorkingVersion
    ) {
      throw conflict('Agent Run 无权结束当前页面请求');
    }
    if (run.status !== 'reading' && run.status !== 'repairing') {
      throw conflict('Agent Run 已提交终态或当前状态不允许提交');
    }
    if (run.status === 'repairing' && run.repairAttempts > scope.maxRepairAttempts) {
      throw new AgentEngineError('BUDGET_EXCEEDED', 'Schema 修复次数已超过本次运行预算');
    }

    const outcome = terminalOutcome(input);
    const outcomeJson =
      input.outcome === 'needs_clarification'
        ? {
            clarificationId: `clarification_${randomUUID()}`,
            baseWorkingVersion: scope.baseWorkingVersion,
            question: input.question,
            ...(input.candidates ? { candidates: input.candidates } : {}),
          }
        : input;
    const operations = input.outcome === 'apply_changes' ? input.operations : undefined;
    const digest = operations ? operationDigest(operations) : undefined;
    const response = terminalResponse(input);
    if (
      operations &&
      Buffer.byteLength(JSON.stringify(operations), 'utf8') > scope.maxSchemaBytes
    ) {
      throw new AgentEngineError('BUDGET_EXCEEDED', 'Operation List 大小已超过本次运行预算');
    }
    const project = dependencies.projects.getProject(scope.projectId);
    const page = dependencies.projects.getPage(scope.projectId, scope.pageId);
    if (!project || !page) throw notFound('页面不存在或不属于当前项目');
    if (input.outcome === 'needs_clarification' && input.candidates?.length) {
      const working = await getWorkingSchemaState({
        projectPath: project.path,
        pageId: page.id,
        slug: page.slug,
        relativePath: page.relativePath,
      });
      if (working.workingVersion !== scope.baseWorkingVersion) {
        throw conflict('页面版本已变化，无法发布当前澄清选项');
      }
      const seen = new Set<string>();
      for (const candidate of input.candidates) {
        if (!working.schema.elements[candidate.elementId] || seen.has(candidate.elementId)) {
          throw invalid('澄清候选必须是当前页面中的不同元素');
        }
        seen.add(candidate.elementId);
      }
    }
    dependencies.runService.transition(scope.runId, 'deciding', {
      outcomeJson,
      ...(!operations ? { outcome } : {}),
      ...(operations ? { operationCount: operations.length, operationDigest: digest } : {}),
    });

    if (!operations) {
      return { accepted: true, outcome, response } satisfies CompletePageRunResult;
    }

    dependencies.runService.transition(scope.runId, 'validating');
    let result: Awaited<ReturnType<typeof applyWorkingSchemaOperations>>;
    try {
      assertNotCancelled(signal);
      result = await applyWorkingSchemaOperations(
        {
          projectPath: project.path,
          pageId: page.id,
          slug: page.slug,
          relativePath: page.relativePath,
        },
        { baseWorkingVersion: scope.baseWorkingVersion, operations },
        {
          beforeWrite: () => assertNotCancelled(signal),
          agentCommit: {
            runId: scope.runId,
            projectId: scope.projectId,
            operationDigest: digest!,
          },
        },
      );
    } catch (error) {
      const current = dependencies.runs.get(scope.runId);
      const isWorkingConflict = error instanceof ApiError && error.statusCode === 409;
      const isCancelled = signal.aborted;
      if (current?.status === 'validating' && !isWorkingConflict && !isCancelled) {
        dependencies.runService.transition(scope.runId, 'repairing', {
          repairAttempts: current.repairAttempts + 1,
        });
      }
      throw error;
    }
    dependencies.runService.recordWorkingCommit(
      scope.runId,
      result.workingVersion,
      result.workingHash,
    );
    dependencies.runService.transition(scope.runId, 'committing', { outcome, outcomeJson });
    return {
      accepted: true,
      outcome,
      response,
      resultWorkingVersion: result.workingVersion,
    } satisfies CompletePageRunResult;
  },
});
