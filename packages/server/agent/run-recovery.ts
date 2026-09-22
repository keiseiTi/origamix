import type { AgentRunRepository } from './run-repository';
import type { ProjectRepository } from '../projects/project-repository';
import type { ConversationService } from '../conversations/conversation-service';
import { AgentRunService } from './run-service';
import { getAgentWorkingCommitReceipt, getWorkingSchemaState } from '../schema/schema-service';

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
  runs: AgentRunRepository,
  projects: ProjectRepository,
  conversations: ConversationService,
): Promise<void> => {
  const service = new AgentRunService(runs);
  const recovered = await service.recover(async (run) => {
    const project = projects.getProject(run.projectId);
    const page = projects.getPage(run.projectId, run.pageId);
    if (!project || !page) return { disposition: 'not_committed' } as const;
    try {
      const pageRef = {
        projectPath: project.path,
        pageId: page.id,
        slug: page.slug,
        relativePath: page.relativePath,
      };
      const receipt = await getAgentWorkingCommitReceipt(pageRef, run.id);
      if (!receipt) return { disposition: 'not_committed' } as const;
      if (
        receipt.runId !== run.id ||
        receipt.projectId !== run.projectId ||
        receipt.pageId !== run.pageId ||
        receipt.baseWorkingVersion !== run.baseWorkingVersion ||
        receipt.operationDigest !== run.operationDigest
      ) {
        return { disposition: 'conflict' } as const;
      }
      const working = await getWorkingSchemaState(pageRef);
      if (
        working.workingVersion === receipt.resultWorkingVersion &&
        working.workingHash === receipt.resultWorkingHash
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
    } catch {
      return { disposition: 'conflict' } as const;
    }
  });
  for (const run of recovered) {
    if (run.status === 'completed') {
      conversations.finishAssistant(run.id, {
        version: '1',
        blocks: [
          {
            type: 'text',
            text: responseFromOutcome(run.outcomeJson) ?? '页面草稿已完成修改。',
          },
        ],
      });
    } else {
      conversations.failAssistant(
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
