import type { RuntimeDiagnostic, RuntimeRenderReport } from '@origamix/shared';

type Entry = Pick<
  RuntimeRenderReport,
  'revisionId' | 'workingVersion' | 'workingHash' | 'previewId' | 'reportSequence' | 'observedAt'
> & {
  diagnostics: RuntimeDiagnostic[];
  touchedAt: number;
};

// Bounded, session-only observations. Working identity, not the saved Revision, owns freshness.
export class RuntimeDiagnosticCache {
  private readonly entries = new Map<string, Entry>();
  constructor(
    private readonly limit = 256,
    private readonly ttlMs = 30 * 60_000,
  ) {}

  replace(report: RuntimeRenderReport, diagnostics: RuntimeDiagnostic[]): boolean {
    this.prune();
    const key = this.key(report.projectId, report.pageId),
      previous = this.entries.get(key);
    if (
      previous &&
      (report.workingVersion < previous.workingVersion ||
        (report.workingVersion === previous.workingVersion &&
          (report.previewId === previous.previewId
            ? report.reportSequence <= previous.reportSequence
            : Date.parse(report.observedAt) <= Date.parse(previous.observedAt))))
    )
      return false;
    this.entries.delete(key);
    this.entries.set(key, { ...report, diagnostics, touchedAt: Date.now() });
    while (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value!);
    return true;
  }
  list(
    projectId: string,
    pageId: string,
    working: { workingVersion: number; workingHash: string },
  ): RuntimeDiagnostic[] {
    this.prune();
    const entry = this.entries.get(this.key(projectId, pageId));
    return entry?.workingVersion === working.workingVersion &&
      entry.workingHash === working.workingHash
      ? [...entry.diagnostics]
      : [];
  }
  remove(projectId: string, pageId?: string): void {
    for (const key of this.entries.keys())
      if (pageId ? key === this.key(projectId, pageId) : key.startsWith(`${projectId}\0`))
        this.entries.delete(key);
  }
  private prune(): void {
    for (const [key, entry] of this.entries)
      if (Date.now() - entry.touchedAt > this.ttlMs) this.entries.delete(key);
  }
  private key(projectId: string, pageId: string): string {
    return `${projectId}\0${pageId}`;
  }
}
