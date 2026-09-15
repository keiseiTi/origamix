import type { AgentRunRepository } from './run-repository';
import type { ProjectRepository } from '../projects/project-repository';
import { AgentRunService } from './run-service';
import { hasValidRevision } from '../schema/schema-service';

/**
 * Reconciles durable Run state during Server startup. It only inspects already
 * committed Schema state and never resumes a provider request.
 */
export const recoverAgentRunsOnStartup = async (
  runs: AgentRunRepository,
  projects: ProjectRepository,
): Promise<void> => {
  const service = new AgentRunService(runs);
  await service.recover(async (run) => {
    if (!run.resultRevisionId) return false;
    const project = projects.getProject(run.projectId);
    const page = projects.getPage(run.projectId, run.pageId);
    if (!project || !page) return false;
    try {
      return await hasValidRevision(
        { projectPath: project.path, pageId: page.id, slug: page.slug },
        run.resultRevisionId,
      );
    } catch {
      return false;
    }
  });
};
