import { and, asc, eq } from 'drizzle-orm';
import type { RuntimeDiagnostic } from '@origamix/shared/protocol/agent';
import type { ApplicationDatabase, DatabaseClient } from '../database/database';
import { pageRuntimeState, runtimeDiagnostics } from '../database/schema';

export class RuntimeDiagnosticRepository {
  private readonly client: DatabaseClient;
  private readonly database?: ApplicationDatabase;
  constructor(database: ApplicationDatabase | DatabaseClient) {
    this.client = 'orm' in database ? database.orm : database;
    this.database = 'orm' in database ? database : undefined;
  }
  replaceForRevision(
    projectId: string,
    pageId: string,
    revisionId: string,
    diagnostics: readonly RuntimeDiagnostic[],
    observedAt: string,
  ): void {
    const action = (client: DatabaseClient): void => {
      client
        .delete(runtimeDiagnostics)
        .where(
          and(
            eq(runtimeDiagnostics.projectId, projectId),
            eq(runtimeDiagnostics.pageId, pageId),
            eq(runtimeDiagnostics.revisionId, revisionId),
          ),
        )
        .run();
      if (diagnostics.length)
        client
          .insert(runtimeDiagnostics)
          .values(
            diagnostics.map((item) => ({
              projectId,
              pageId,
              revisionId,
              code: item.code,
              severity: item.severity,
              stage: item.stage,
              elementId: item.elementId ?? null,
              materialType: item.materialType ?? null,
              safeMessage: item.safeMessage,
              observedAt,
            })),
          )
          .run();
    };
    if (this.database) this.database.transaction(action);
    else action(this.client);
  }
  listForRevision(projectId: string, pageId: string, revisionId: string): RuntimeDiagnostic[] {
    return this.client
      .select()
      .from(runtimeDiagnostics)
      .where(
        and(
          eq(runtimeDiagnostics.projectId, projectId),
          eq(runtimeDiagnostics.pageId, pageId),
          eq(runtimeDiagnostics.revisionId, revisionId),
        ),
      )
      .orderBy(asc(runtimeDiagnostics.id))
      .all()
      .map((row) => ({
        code: row.code,
        severity: row.severity as RuntimeDiagnostic['severity'],
        stage: row.stage as RuntimeDiagnostic['stage'],
        pageId: row.pageId,
        revisionId: row.revisionId,
        ...(row.elementId ? { elementId: row.elementId } : {}),
        ...(row.materialType ? { materialType: row.materialType } : {}),
        safeMessage: row.safeMessage,
      }));
  }
  getLastKnownGood(projectId: string, pageId: string): string | undefined {
    return (
      this.client
        .select({ id: pageRuntimeState.lastKnownGoodRevisionId })
        .from(pageRuntimeState)
        .where(and(eq(pageRuntimeState.projectId, projectId), eq(pageRuntimeState.pageId, pageId)))
        .get()?.id ?? undefined
    );
  }
  setLastKnownGood(projectId: string, pageId: string, revisionId: string, updatedAt: string): void {
    this.client
      .insert(pageRuntimeState)
      .values({ projectId, pageId, lastKnownGoodRevisionId: revisionId, updatedAt })
      .onConflictDoUpdate({
        target: [pageRuntimeState.projectId, pageRuntimeState.pageId],
        set: { lastKnownGoodRevisionId: revisionId, updatedAt },
      })
      .run();
  }
}
