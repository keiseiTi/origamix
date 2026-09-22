import { describe, expect, it } from 'vitest';
import { ApplicationDatabase } from '../../database/database';
import { AgentToolAuditRepository } from '../../agent/tool-audit-repository';

describe('Agent tool audit persistence', () => {
  it('retains ordered safe evidence without tool arguments or Schema content', () => {
    const database = new ApplicationDatabase(':memory:');
    try {
      const audits = new AgentToolAuditRepository(database);
      audits.append({
        runId: 'run_one',
        toolName: 'complete_page_run',
        phase: 'started',
        occurredAt: '2026-09-22T00:00:00.000Z',
        durationMs: 0,
        operationCount: 1,
        operationTypeCounts: { updateElementProps: 1 },
        operationDigest: 'a'.repeat(64),
      });
      audits.append({
        runId: 'run_one',
        toolName: 'complete_page_run',
        phase: 'completed',
        occurredAt: '2026-09-22T00:00:00.010Z',
        durationMs: 10,
        operationCount: 1,
        operationTypeCounts: { updateElementProps: 1 },
        operationDigest: 'a'.repeat(64),
      });

      const stored = audits.list('run_one');
      expect(stored.map(({ sequence, phase }) => ({ sequence, phase }))).toEqual([
        { sequence: 0, phase: 'started' },
        { sequence: 1, phase: 'completed' },
      ]);
      expect(stored[1]).toMatchObject({
        durationMs: 10,
        operationCount: 1,
        operationTypeCounts: { updateElementProps: 1 },
      });
      expect(JSON.stringify(stored)).not.toContain('operations');
      expect(JSON.stringify(stored)).not.toContain('schema');
    } finally {
      database.close();
    }
  });
});
