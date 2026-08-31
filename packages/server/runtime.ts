import { ApplicationDatabase } from './database/database';
import { ProjectRepository } from './repositories/project-repository';
import { WorkspaceRepository } from './repositories/workspace-repository';
import { ProjectService } from './services/project-service';
import { createHttpServer } from './transport/http/server';

export async function startServer(input: {
  databasePath: string;
  templatePath: string;
  desktopToken: string;
  serviceInstanceId: string;
  projectPath?: string;
  allowedOrigins?: readonly string[];
}) {
  const database = new ApplicationDatabase(input.databasePath);
  const projects = new ProjectRepository(database);
  const workspace = new WorkspaceRepository(database);
  const projectService = new ProjectService(projects, workspace, input.templatePath);
  const server = createHttpServer({ ...input, projects, workspace, projectService });
  try {
    // Only an explicit host-side startup option grants access to an existing directory.
    if (input.projectPath) {
      projectService.registerGrant('startup-project', input.projectPath);
      const project = await projectService.openProject({ directoryGrantId: 'startup-project' });
      workspace.save({ activeProjectId: project.id, activePageId: projects.listPages(project.id)[0]?.id ?? null });
    }
    await server.listen({ host: '127.0.0.1', port: 0 });
    const address = server.server.address();
    if (!address || typeof address === 'string') throw new Error('无法取得 HTTP 服务端口');
    return {
      port: address.port,
      registerGrant: (id: string, path: string) => projectService.registerGrant(id, path),
      close: async () => { await server.close(); database.close(); }
    };
  } catch (error) {
    await server.close();
    database.close();
    throw error;
  }
}
