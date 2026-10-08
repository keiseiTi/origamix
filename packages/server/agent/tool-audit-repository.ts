import { asc, eq, sql } from 'drizzle-orm';
import type { ApplicationDatabase, DatabaseClient } from '../database/database';
import { agentToolAudits } from '../database/schema';
import { runKey, runPublicId } from '../database/identity';
import type { ToolAuditEvent } from './tools/registry';

export interface AgentToolAuditRecord extends ToolAuditEvent {
  id: number;
  sequence: number;
}

export class AgentToolAuditRepository {
  private readonly client: DatabaseClient;

  constructor(database: ApplicationDatabase | DatabaseClient) {
    this.client = 'orm' in database ? database.orm : database;
  }

  append(event: ToolAuditEvent): AgentToolAuditRecord {
    const sequence = Number(
      this.client
        .select({ value: sql<number>`coalesce(max(${agentToolAudits.sequence}), -1) + 1` })
        .from(agentToolAudits)
        .where(eq(agentToolAudits.runId, runKey(this.client, event.runId)))
        .get()?.value ?? 0,
    );
    const result = this.client
      .insert(agentToolAudits)
      .values({
        runId: runKey(this.client, event.runId),
        sequence,
        toolName: event.toolName,
        phase: event.phase,
        safeErrorCode: event.safeErrorCode ?? null,
        durationMs: event.durationMs,
        operationCount: event.operationCount ?? null,
        operationTypeCountsJson: event.operationTypeCounts
          ? JSON.stringify(event.operationTypeCounts)
          : null,
        operationDigest: event.operationDigest ?? null,
        occurredAt: event.occurredAt,
      })
      .run();
    return { ...event, id: Number(result.lastInsertRowid), sequence };
  }

  list(runId: string): AgentToolAuditRecord[] {
    return this.client
      .select()
      .from(agentToolAudits)
      .where(eq(agentToolAudits.runId, runKey(this.client, runId)))
      .orderBy(asc(agentToolAudits.sequence))
      .all()
      .map((row) => ({
        id: row.id,
        runId: runPublicId(this.client, row.runId),
        sequence: row.sequence,
        toolName: row.toolName,
        phase: row.phase as ToolAuditEvent['phase'],
        ...(row.safeErrorCode ? { safeErrorCode: row.safeErrorCode } : {}),
        durationMs: row.durationMs,
        ...(row.operationCount === null ? {} : { operationCount: row.operationCount }),
        ...(row.operationTypeCountsJson
          ? {
              operationTypeCounts: JSON.parse(row.operationTypeCountsJson) as Record<
                string,
                number
              >,
            }
          : {}),
        ...(row.operationDigest ? { operationDigest: row.operationDigest } : {}),
        occurredAt: row.occurredAt,
      }));
  }
}
