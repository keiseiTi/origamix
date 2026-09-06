import type { AgentRunRepository } from '../repositories/agent-run-repository';
import type { ProjectRepository } from '../repositories/project-repository';
import { AgentRunService } from './agent-run-service';
import { hasValidRevision } from './schema-service';

/**
 * Reconciles durable Run state during Server startup. It only inspects already
 * committed Schema state and never resumes a provider request.
 */
export async function recoverAgentRunsOnStartup(
  runs: AgentRunRepository,
  projects: ProjectRepository,
): Promise<void> {
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
}
