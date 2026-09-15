import type { RuntimeDiagnostic } from '@origamix/shared/protocol/agent';

// Runtime failures are session-only UI feedback, not durable project history.
export class RuntimeDiagnosticCache {
  private readonly byRevision = new Map<string, RuntimeDiagnostic[]>();

  replaceForRevision(
    projectId: string,
    pageId: string,
    revisionId: string,
    diagnostics: readonly RuntimeDiagnostic[],
    observedAt: string,
  ): void {
    void observedAt;
    this.byRevision.set(this.key(projectId, pageId, revisionId), [...diagnostics]);
  }
  listForRevision(projectId: string, pageId: string, revisionId: string): RuntimeDiagnostic[] {
    return [...(this.byRevision.get(this.key(projectId, pageId, revisionId)) ?? [])];
  }

  private key(projectId: string, pageId: string, revisionId: string): string {
    return `${projectId}\u0000${pageId}\u0000${revisionId}`;
  }
}
