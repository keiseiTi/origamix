import { RuntimeDiagnosticCache } from '../diagnostics/diagnostic-cache';
import { RuntimeDiagnosticService } from '../diagnostics/diagnostic-service';
import { getWorkingSchemaState } from '../schema/schema-service';
import { openWebDatabase } from '../database/mysql-web';
import type { TemplateDownload } from '../http/types';
import { createHttpServer } from '../http/server';
import { MysqlProjectService } from '../projects/mysql-project-service';

export const startMysqlWebServer = async (input: {
  mysqlUrl: string;
  desktopToken: string;
  serviceInstanceId: string;
  templateDownload: TemplateDownload;
}) => {
  const pool = await openWebDatabase(input.mysqlUrl);
  const projects = new MysqlProjectService(pool);
  const server = createHttpServer({
    desktopToken: input.desktopToken,
    serviceInstanceId: input.serviceInstanceId,
    templateDownload: input.templateDownload,
    allowedOrigins: [],
    projects,
    projectService: projects,
    createDatabaseProject: projects.createDatabaseProject.bind(projects),
    resolveSchemaPage: projects.resolveSchemaPage,
    runtimeDiagnostics: new RuntimeDiagnosticService(
      undefined,
      new RuntimeDiagnosticCache(),
      (projectId, pageId) => getWorkingSchemaState(projects.resolveSchemaPage(projectId, pageId)),
    ),
  });
  try {
    await server.listen({ host: '127.0.0.1', port: 0 });
    const address = server.server.address();
    if (!address || typeof address === 'string') throw new Error('无法取得 HTTP 服务端口');
    return {
      port: address.port,
      close: async () => {
        await server.close();
        await pool.end();
      },
    };
  } catch (error) {
    await server.close();
    await pool.end();
    throw error;
  }
};
