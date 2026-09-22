import { randomUUID } from 'node:crypto';
import { asc, eq, sql } from 'drizzle-orm';
import type { ApplicationDatabase, DatabaseClient } from '../database/database';
import { agentToolAudits } from '../database/schema';
import type { ToolAuditEvent } from './tools/registry';

export interface AgentToolAuditRecord extends ToolAuditEvent {
  id: string;
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
        .where(eq(agentToolAudits.runId, event.runId))
        .get()?.value ?? 0,
    );
    const record: AgentToolAuditRecord = {
      ...event,
      id: `audit_${randomUUID()}`,
      sequence,
    };
    this.client
      .insert(agentToolAudits)
      .values({
        id: record.id,
        runId: record.runId,
        sequence,
        toolName: record.toolName,
        phase: record.phase,
        safeErrorCode: record.safeErrorCode ?? null,
        durationMs: record.durationMs,
        operationCount: record.operationCount ?? null,
        operationTypeCountsJson: record.operationTypeCounts
          ? JSON.stringify(record.operationTypeCounts)
          : null,
        operationDigest: record.operationDigest ?? null,
        occurredAt: record.occurredAt,
      })
      .run();
    return record;
  }

  list(runId: string): AgentToolAuditRecord[] {
    return this.client
      .select()
      .from(agentToolAudits)
      .where(eq(agentToolAudits.runId, runId))
      .orderBy(asc(agentToolAudits.sequence))
      .all()
      .map((row) => ({
        id: row.id,
        runId: row.runId,
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
