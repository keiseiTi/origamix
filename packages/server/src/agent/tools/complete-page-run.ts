import type { ProjectMaterialReader } from './material-reader';
import { createHash, randomUUID } from 'node:crypto';
import { Value } from '@sinclair/typebox/value';
import {
  CompletePageRunInputSchema,
  CompletePageRunToolParametersSchema,
  type CompletePageRunInput,
  type ClarificationCandidate,
  type PageAgentOutcome,
  getAgentElementLabel,
  type SchemaOperation,
} from '@origamix/shared';

import type { AgentRunRepository } from '../run-repository';
import type { AgentRunService } from '../run-service';
import type { ProjectRepository } from '../../projects/project-repository';
import { ApiError, conflict, invalid, notFound } from '../../errors';
import { applyWorkingSchemaOperations, getWorkingSchemaState } from '../../schema/schema-service';
import { SchemaValidationError } from '../../schema/validation/schema-validation';
import { AgentEngineError, AgentToolValidationError, type AgentEngineTool } from '../agent-engine';

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
  loadMaterials: ProjectMaterialReader;
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
): AgentEngineTool => {
  let rejectedWrite = false;
  return {
    name: 'complete_page_run',
    description:
      '结束当前页面请求。每个 Run 必须且只能成功调用一次。需要修改时提交完整 operations 和最终回复；多个已有元素匹配但用户没有指定目标或明确批量范围时，必须提交 needs_clarification、question 和真实元素 candidates，不得先修改。只回答、无需修改或拒绝时提交对应 outcome。',
    parameters: CompletePageRunToolParametersSchema,
    execute: async (raw, signal) => {
      if (!Value.Check(CompletePageRunInputSchema, raw)) {
        const outcome =
          raw && typeof raw === 'object' && !Array.isArray(raw)
            ? (raw as { outcome?: unknown }).outcome
            : undefined;
        if (outcome === 'apply_changes') rejectedWrite = true;
        const variant = CompletePageRunInputSchema.anyOf.find(
          (schema) => schema.properties.outcome.const === outcome,
        );
        const errors = [...Value.Errors(variant ?? CompletePageRunToolParametersSchema, raw)];
        const detail = errors
          .slice(0, 3)
          .map((error) => `${error.path || '/'}: ${error.message}`)
          .join('；');
        throw new AgentToolValidationError({
          kind: 'page_run_validation',
          baseWorkingVersion: scope.baseWorkingVersion,
          retryable: true,
          errors: errors.slice(0, 3).map((error) => ({
            code: 'INVALID_TOOL_INPUT',
            path: error.path || '/',
            message: error.message,
          })),
          instruction: `complete_page_run 参数无效${detail ? `：${detail}` : ''}；保留其他操作，针对原始 baseWorkingVersion 重新提交完整 operations。`,
        });
      }
      assertNotCancelled(signal);
      const input = raw as CompletePageRunInput;
      if (
        rejectedWrite &&
        (input.outcome === 'no_change_needed' || input.outcome === 'answer_only')
      ) {
        throw invalid(
          '本轮页面写入尚未成功，必须修正并提交 apply_changes，不能报告无需修改或只回答',
        );
      }
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
      const materials = await dependencies.loadMaterials(project.path);
      let candidates: ClarificationCandidate[] | undefined;
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
        candidates = input.candidates.map((candidate) => ({
          ...candidate,
          label: getAgentElementLabel(
            candidate.elementId,
            working.schema.elements[candidate.elementId],
            materials.manifest.materials.find(
              (material) => material.type === working.schema.elements[candidate.elementId]?.type,
            )?.title,
          ),
        }));
      }
      const outcomeJson =
        input.outcome === 'needs_clarification'
          ? {
              clarificationId: `clarification_${randomUUID()}`,
              baseWorkingVersion: scope.baseWorkingVersion,
              question: input.question,
              ...(candidates ? { candidates } : {}),
            }
          : input;
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
        rejectedWrite = true;
        const current = dependencies.runs.get(scope.runId);
        const isWorkingConflict = error instanceof ApiError && error.statusCode === 409;
        const isCancelled = signal.aborted;
        if (
          current?.status === 'validating' &&
          error instanceof SchemaValidationError &&
          !isWorkingConflict &&
          !isCancelled
        ) {
          dependencies.runService.transition(scope.runId, 'repairing', {
            repairAttempts: current.repairAttempts + 1,
          });
        }
        if (isWorkingConflict)
          throw new AgentToolValidationError({
            kind: 'page_run_validation',
            baseWorkingVersion: scope.baseWorkingVersion,
            retryable: false,
            errors: [
              {
                code: 'WORKING_VERSION_CONFLICT',
                path: '/baseWorkingVersion',
                message: '页面草稿已变化，本次批次不能重试。',
              },
            ],
            instruction: '停止修改；重新读取页面后由用户发起新请求，不重放本次操作。',
          });
        if (error instanceof SchemaValidationError) {
          const canRepair =
            !isCancelled &&
            (dependencies.runs.get(scope.runId)?.repairAttempts ?? 0) <= scope.maxRepairAttempts;
          const flowId = error.issue.path.startsWith('/flows/')
            ? error.issue.path.split('/')[2]!.replaceAll('~1', '/').replaceAll('~0', '~')
            : undefined;
          let operationIndex = error.issue.operationIndex;
          if (flowId) {
            for (let index = operations.length - 1; index >= 0; index -= 1) {
              const operation = operations[index]!;
              if ('flowId' in operation && operation.flowId === flowId) {
                if (operation.operation === 'addFlow' || operation.operation === 'updateFlow') {
                  operationIndex = index;
                  break;
                }
                if (operationIndex === undefined) operationIndex = index;
              }
            }
          }
          throw new AgentToolValidationError({
            kind: 'page_run_validation',
            baseWorkingVersion: scope.baseWorkingVersion,
            retryable: canRepair,
            errors: [
              { ...error.issue, ...(operationIndex !== undefined ? { operationIndex } : {}) },
            ],
            instruction: canRepair
              ? 'Working 未改变。按 code/path/operationIndex 修复原批次，保留其他操作，针对原始 baseWorkingVersion 重新提交完整 operations；需要时读取节点 Manifest。'
              : 'Working 未改变。修复次数已用尽或 Run 已取消，停止提交并保留草稿。',
          });
        }
        if (isCancelled) throw error;
        throw new AgentToolValidationError({
          kind: 'page_run_validation',
          baseWorkingVersion: scope.baseWorkingVersion,
          retryable: false,
          errors: [
            { code: 'WORKING_COMMIT_UNCONFIRMED', path: '/', message: '草稿提交结果尚未确认。' },
          ],
          instruction: '停止修改并恢复页面状态，不能自动重放本次批次。',
        });
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
  };
};
