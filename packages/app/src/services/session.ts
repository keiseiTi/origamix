import type { LayoutWorkingState, RevisionHistoryItem, SessionTarget } from '@origamix/shared';
import { schemaService } from './schema';
import { layoutService } from './layout';

export type SessionKind = SessionTarget['kind'];
const working = (value: LayoutWorkingState) => ({ ...value, schema: value.document.schema });
/** UI session keys never become server page IDs for layout targets. */
export const sessionService = (kind: SessionKind) =>
  kind === 'page'
    ? schemaService
    : {
        workingState: async (projectId: string) =>
          working(await layoutService.workingState(projectId)),
        applyWorkingOperations: async (
          projectId: string,
          _sessionId: string,
          version: number,
          operations: Parameters<typeof schemaService.applyWorkingOperations>[3],
          requestId: string = crypto.randomUUID(),
        ) => working(await layoutService.operations(projectId, version, operations, requestId)),
        updateWorking: async (
          projectId: string,
          _sessionId: string,
          version: number,
          schema: Parameters<typeof schemaService.updateWorking>[3],
          requestId: string = crypto.randomUUID(),
        ) => working(await layoutService.update(projectId, version, schema, requestId)),
        saveRevision: async (projectId: string, _sessionId: string, version: number) =>
          working(await layoutService.saveRevision(projectId, version)),
        restoreRevision: async (
          projectId: string,
          _sessionId: string,
          revisionId: string,
          version: number,
        ) => working(await layoutService.restoreRevision(projectId, revisionId, version)),
        listRevisions: async (projectId: string) => ({
          revisions: (await layoutService.listRevisions(projectId)).revisions.map(
            (item): RevisionHistoryItem => ({
              ...item,
              source: { kind: 'user' },
              isApplied: false,
            }),
          ),
        }),
        getRevision: async (projectId: string, _sessionId: string, revisionId: string) => {
          const value = await layoutService.getRevision(projectId, revisionId);
          return { schema: value.document.schema, revisionId: value.revisionId };
        },
        applyState: async (projectId: string) => {
          const value = await layoutService.applyState(projectId);
          return {
            ...value,
            status: value.status === 'apply_pending' ? ('result_pending' as const) : value.status,
          };
        },
        apply: (
          projectId: string,
          _sessionId: string,
          revisionId: string,
          version: number,
          requestId: string,
        ) => layoutService.apply(projectId, revisionId, version, requestId),
        reloadFromProject: async (): Promise<never> => {
          throw new Error('布局文件已被外部修改，请检查并恢复目标文件；草稿已保留');
        },
      };
