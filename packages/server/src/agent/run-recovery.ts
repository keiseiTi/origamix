import type { DiagnosticLogger } from '../logging/logger';
import type {
  AgentRunStore,
  AgentConversations,
  AgentProjects,
  AgentSchemaPage,
} from './persistence';
import { ApiError } from '../errors';
import { AgentRunService } from './run-service';
import { getAgentWorkingCommitEvidence, requireFileSchemaPage } from '../schema/schema-service';

const responseFromOutcome = (value: unknown): string | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const response = (value as { response?: unknown }).response;
  return typeof response === 'string' && response ? response : undefined;
};

/**
 * Reconciles durable Run state during Server startup. It only inspects already
 * committed Schema state and never resumes a provider request.
 */
export const recoverAgentRunsOnStartup = async (
  runs: AgentRunStore,
  projects: AgentProjects,
  conversations: Pick<AgentConversations, 'finishAssistant' | 'failAssistant'>,
  resolvePage?: AgentSchemaPage,
  logger?: DiagnosticLogger,
): Promise<void> => {
  const service = new AgentRunService(runs);
  const recovered = await service.recover(async (run) => {
    const project = await projects.getProject(run.projectId);
    const page = run.pageId ? await projects.getPage(run.projectId, run.pageId) : undefined;
    if (!project || !page) return { disposition: 'not_committed' } as const;
    let transactional = false;
    try {
      const pageRef =
        resolvePage?.(run.projectId, run.pageId) ?? requireFileSchemaPage(project, page);
      transactional = Boolean(pageRef.withPersistence);
      const evidence = await getAgentWorkingCommitEvidence(pageRef, run.id);
      if (!evidence) return { disposition: 'not_committed' } as const;
      const { receipt, working } = evidence;
      if (
        receipt.version !== 1 ||
        receipt.runId !== run.id ||
        receipt.projectId !== run.projectId ||
        receipt.pageId !== run.pageId ||
        receipt.baseWorkingVersion !== run.baseWorkingVersion ||
        !run.operationDigest ||
        receipt.operationDigest !== run.operationDigest
      ) {
        return { disposition: 'conflict' } as const;
      }
      if (
        (working.workingVersion === receipt.resultWorkingVersion &&
          working.workingHash === receipt.resultWorkingHash) ||
        // MySQL commits the receipt and Working in the same transaction. A later explicit
        // canvas edit cannot invalidate the evidence of this already committed mutation.
        (transactional &&
          receipt.state === 'committed' &&
          working.workingVersion > receipt.resultWorkingVersion)
      ) {
        return {
          disposition: 'committed',
          resultWorkingVersion: receipt.resultWorkingVersion,
          resultWorkingHash: receipt.resultWorkingHash,
        } as const;
      }
      if (working.workingVersion === receipt.baseWorkingVersion) {
        return { disposition: 'not_committed' } as const;
      }
      return { disposition: 'conflict' } as const;
    } catch (error) {
      if (transactional && !(error instanceof ApiError)) throw error;
      return { disposition: 'conflict' } as const;
    }
  });
  for (const run of recovered) {
    logger?.[run.recoveredCommit ? 'info' : 'warn']({
      event: 'agent.run.recovered',
      runId: run.id,
      status: run.status,
      recoveredCommit: run.recoveredCommit,
      resultWorkingVersion: run.resultWorkingVersion,
      errorCode: run.errorCode,
    });
    if (run.status === 'completed') {
      await conversations.finishAssistant(run.id, {
        version: '1',
        blocks: [
          {
            type: 'text',
            text: responseFromOutcome(run.outcomeJson) ?? '页面草稿已完成修改。',
          },
        ],
      });
    } else {
      await conversations.failAssistant(
        run.id,
        {
          version: '1',
          blocks: [{ type: 'text', text: run.errorMessage ?? 'Agent 运行已中断。' }],
        },
        run.errorCode ?? 'PROCESS_INTERRUPTED',
      );
    }
  }
};
