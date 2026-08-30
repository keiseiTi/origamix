import { ApplicationDatabase } from './database/database';
import { ProjectRepository } from './repositories/project-repository';
import { WorkspaceRepository } from './repositories/workspace-repository';
import { ProjectService } from './services/project-service';
import { createHttpServer } from './transport/http/server';

let stop: (() => Promise<void>) | undefined;
const controlPort = process.parentPort;

if (!controlPort) {
  throw new Error('Origamix Server 必须作为 Electron Utility Process 启动');
}

controlPort.on('message', async (event: { data: unknown }) => {
  const message = event.data;
  if (!message || typeof message !== 'object') return;
  const payload = message as {
    kind?: string;
    databasePath?: string;
    desktopToken?: string;
    serviceInstanceId?: string;
    grantId?: string;
    path?: string;
  };
  if (payload.kind === 'grant' && payload.grantId && payload.path) {
    (globalThis as { projectService?: ProjectService }).projectService?.registerGrant(
      payload.grantId,
      payload.path
    );
    return;
  }
  if (payload.kind === 'shutdown') {
    await stop?.();
    process.exit(0);
  }
  if (
    payload.kind !== 'initialize' ||
    !payload.databasePath ||
    !payload.desktopToken ||
    !payload.serviceInstanceId
  )
    return;
  try {
    const database = new ApplicationDatabase(payload.databasePath);
    const projects = new ProjectRepository(database);
    const workspace = new WorkspaceRepository(database);
    const projectService = new ProjectService(projects, workspace);
    (globalThis as { projectService?: ProjectService }).projectService = projectService;
    const server = createHttpServer({
      desktopToken: payload.desktopToken,
      serviceInstanceId: payload.serviceInstanceId,
      projects,
      workspace,
      projectService
    });
    await server.listen({ host: '127.0.0.1', port: 0 });
    const address = server.server.address();
    if (!address || typeof address === 'string') throw new Error('无法取得 HTTP 服务端口');
    stop = async () => {
      await server.close();
      database.close();
    };
    controlPort.postMessage({
      kind: 'ready',
      port: address.port,
      serviceInstanceId: payload.serviceInstanceId
    });
  } catch (error) {
    controlPort.postMessage({
      kind: 'error',
      message: error instanceof Error ? error.message : '后台启动失败'
    });
  }
});
