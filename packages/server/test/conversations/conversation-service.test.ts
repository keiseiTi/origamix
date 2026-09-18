import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { MessageContent, RunBudget } from '@origamix/shared/protocol/agent';
import { ApplicationDatabase } from '../../database/database';
import { AgentRunRepository, type AgentRunRecord } from '../../agent/run-repository';
import { ConversationRepository } from '../../conversations/conversation-repository';
import { ProjectRepository } from '../../projects/project-repository';
import { AgentRunService, canTransitionAgentRun } from '../../agent/run-service';
import {
  ConversationService,
  type StartConversationRunInput,
} from '../../conversations/conversation-service';

const directories: string[] = [];
const content = (text: string): MessageContent => ({
  version: '1',
  blocks: [{ type: 'text', text }],
});
const budget: RunBudget = {
  maxModelCalls: 6,
  maxToolCalls: 12,
  maxOutputTokens: 16_000,
  maxDurationMs: 120_000,
  maxSchemaBytes: 262_144,
  maxRepairAttempts: 1,
};

const setup = (path?: string) => {
  const database = new ApplicationDatabase(path ?? ':memory:');
  const timestamp = new Date().toISOString();
  database.connection
    .prepare(
      'INSERT INTO projects (id, path, name, status, created_at, last_opened_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run('project_a', '/tmp/project-a', 'A', 0, timestamp, timestamp);
  database.connection
    .prepare(
      'INSERT INTO pages (id, project_id, slug, name, relative_path, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run('page_a', 'project_a', 'a', 'A', 'pages/a', 0, timestamp, timestamp);
  database.connection
    .prepare(
      'INSERT INTO pages (id, project_id, slug, name, relative_path, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run('page_b', 'project_a', 'b', 'B', 'pages/b', 0, timestamp, timestamp);
  const conversations = new ConversationRepository(database);
  const runs = new AgentRunRepository(database);
  return {
    database,
    conversations,
    runs,
    service: new ConversationService(
      database,
      new ProjectRepository(database),
      conversations,
      runs,
    ),
    runService: new AgentRunService(runs),
  };
};

const input = (overrides: Partial<StartConversationRunInput> = {}): StartConversationRunInput => {
  return {
    projectId: 'project_a',
    pageId: 'page_a',
    clientRequestId: 'request-1',
    baseWorkingVersion: 1,
    content: content('创建表单'),
    modelRef: 'deepseek/deepseek-v4-flash',
    mode: 'page_modify',
    budget,
    promptVersion: '1',
    policyVersion: '1',
    toolsetVersion: '1',
    materialManifestVersion: 'official-antd@1.0.0',
    ...overrides,
  };
};

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('Conversation persistence', () => {
  it('creates one user message and run atomically and deduplicates clientRequestId', () => {
    const { database, service } = setup();
    const first = service.startRun(input());
    const duplicate = service.startRun(input());
    expect(duplicate.run.id).toBe(first.run.id);
    expect(service.history('project_a', 'page_a', first.conversation.id)).toHaveLength(1);
    expect(() => service.startRun(input({ baseWorkingVersion: 2 }))).toThrow('不同请求');
    database.close();
  });

  it('rolls back a newly created conversation and user message when run creation fails', () => {
    const fixture = setup();
    class FailingRunRepository extends AgentRunRepository {
      override create(): AgentRunRecord {
        throw new Error('injected run failure');
      }
    }
    const service = new ConversationService(
      fixture.database,
      new ProjectRepository(fixture.database),
      fixture.conversations,
      new FailingRunRepository(fixture.database),
    );
    expect(() => service.startRun(input())).toThrow('injected run failure');
    expect(
      fixture.database.connection.prepare('SELECT COUNT(*) AS count FROM conversations').get(),
    ).toMatchObject({ count: 0 });
    expect(
      fixture.database.connection.prepare('SELECT COUNT(*) AS count FROM messages').get(),
    ).toMatchObject({ count: 0 });
    fixture.database.close();
  });

  it('enforces page ownership, message sequence, soft deletion and orphan auditing', () => {
    const { database, service, conversations } = setup();
    const started = service.startRun(input());
    expect(() => service.history('project_a', 'page_b', started.conversation.id)).toThrow('不属于');
    const first = conversations.getMessage(started.message.messageId)!;
    expect(() =>
      conversations.appendMessage({
        ...first,
        messageId: 'message_duplicate',
        sequence: first.sequence,
      }),
    ).toThrow();
    expect(conversations.softDelete(started.conversation.id, new Date().toISOString())).toBe(true);
    expect(conversations.get(started.conversation.id)).toBeUndefined();
    expect(() => service.history('project_a', 'page_a', started.conversation.id)).toThrow('不存在');
    database.connection
      .prepare(
        'INSERT INTO messages (id, conversation_id, role, content_json, status, sequence, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        'message_orphan',
        'conversation_missing',
        'user',
        JSON.stringify(content('x')),
        2,
        0,
        first.createdAt,
        first.createdAt,
      );
    expect(conversations.listOrphanMessageIds()).toContain('message_orphan');
    database.connection
      .prepare(
        'INSERT INTO conversations (id, project_id, page_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        'conversation_orphan',
        'project_a',
        'page_missing',
        'orphan',
        0,
        first.createdAt,
        first.createdAt,
      );
    expect(conversations.listOrphanConversationIds()).toContain('conversation_orphan');
    database.close();
  });

  it('rejects invalid JSON and preserves failed assistant checkpoints without secret details', () => {
    const { database, service, conversations } = setup();
    const started = service.startRun(input());
    database.connection
      .prepare(
        'INSERT INTO messages (id, conversation_id, role, content_json, status, sequence, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        'message_bad',
        started.conversation.id,
        'assistant',
        '{',
        3,
        1,
        started.message.createdAt,
        started.message.createdAt,
      );
    expect(() => conversations.listMessages(started.conversation.id)).toThrow('不是合法 JSON');
    database.connection.prepare('DELETE FROM messages WHERE id = ?').run('message_bad');
    const failed = service.failAssistant(
      started.run.id,
      content('模型暂时不可用，请重试。'),
      'PROVIDER_ERROR',
    );
    expect(failed).toMatchObject({ status: 'failed', errorCode: 'PROVIDER_ERROR' });
    expect(JSON.stringify(failed)).not.toContain('api-key');
    database.close();
  });

  it('restores ordered checkpoint history and validates retry ownership', () => {
    const { database, service } = setup();
    const first = service.startRun(input());
    service.checkpointAssistant(first.run.id, content('草稿'));
    service.finishAssistant(first.run.id, content('完成'));
    const retry = service.startRun(
      input({
        clientRequestId: 'request-2',
        conversationId: first.conversation.id,
        retryOfRunId: first.run.id,
      }),
    );
    expect(retry.run.retryOfRunId).toBe(first.run.id);
    expect(
      service
        .history('project_a', 'page_a', first.conversation.id)
        .map((message) => message.sequence),
    ).toEqual([0, 1, 2]);
    expect(() =>
      service.startRun(
        input({ clientRequestId: 'request-3', pageId: 'page_b', retryOfRunId: first.run.id }),
      ),
    ).toThrow('归属');
    database.close();
  });
});

describe('Agent Run state and recovery', () => {
  it('defines the complete legal and illegal transition matrix', () => {
    const statuses = [
      'queued',
      'classifying',
      'generating',
      'tool_calling',
      'validating',
      'committing',
      'awaiting_confirmation',
      'cancelling',
      'completed',
      'failed',
      'cancelled',
      'interrupted',
    ] as const;
    const legal: Record<(typeof statuses)[number], readonly (typeof statuses)[number][]> = {
      queued: ['classifying', 'cancelling', 'failed', 'interrupted'],
      classifying: ['generating', 'completed', 'cancelling', 'failed', 'interrupted'],
      generating: [
        'tool_calling',
        'validating',
        'completed',
        'awaiting_confirmation',
        'cancelling',
        'failed',
        'interrupted',
      ],
      tool_calling: [
        'generating',
        'validating',
        'awaiting_confirmation',
        'cancelling',
        'failed',
        'interrupted',
      ],
      validating: ['generating', 'committing', 'cancelling', 'failed', 'interrupted'],
      committing: ['completed', 'cancelling', 'failed', 'interrupted'],
      awaiting_confirmation: [
        'generating',
        'tool_calling',
        'validating',
        'cancelling',
        'cancelled',
        'failed',
        'interrupted',
      ],
      cancelling: ['cancelled', 'completed', 'failed', 'interrupted'],
      completed: [],
      failed: [],
      cancelled: [],
      interrupted: [],
    };
    for (const from of statuses) {
      for (const to of statuses)
        expect(canTransitionAgentRun(from, to)).toBe(legal[from].includes(to));
    }
  });

  it('accepts legal transitions and rejects rollback or page completion without revision', () => {
    const { database, service, runService } = setup();
    const { run } = service.startRun(input());
    expect(runService.transition(run.id, 'classifying').status).toBe('classifying');
    expect(runService.transition(run.id, 'generating').status).toBe('generating');
    expect(() => runService.transition(run.id, 'queued')).toThrow('不能');
    expect(() => runService.transition(run.id, 'completed')).toThrow('Working 版本');
    expect(runService.transition(run.id, 'validating').status).toBe('validating');
    expect(runService.transition(run.id, 'committing').status).toBe('committing');
    expect(
      runService.transition(run.id, 'completed', {
        resultWorkingVersion: 2,
      }).status,
    ).toBe('completed');
    expect(runService.cancel(run.id).status).toBe('completed');
    database.close();
  });

  it('makes repeated cancellation idempotent and lets a committed terminal result win', () => {
    const { database, service, runService } = setup();
    const { run } = service.startRun(input());
    expect(runService.cancel(run.id).status).toBe('cancelling');
    expect(runService.cancel(run.id).status).toBe('cancelling');
    expect(
      runService.transition(run.id, 'completed', {
        resultWorkingVersion: 2,
      }).status,
    ).toBe('completed');
    expect(runService.cancel(run.id).status).toBe('completed');
    database.close();
  });

  it('recovers committed active runs and interrupts uncommitted runs without retrying work', async () => {
    const { database, service, runs, runService } = setup();
    const committed = service.startRun(input()).run;
    runService.transition(committed.id, 'classifying');
    runs.updateStatus(committed.id, ['classifying'], {
      status: 'committing',
      updatedAt: new Date().toISOString(),
      resultWorkingVersion: 2,
    });
    const pending = service.startRun(input({ clientRequestId: 'request-2' })).run;
    runService.transition(pending.id, 'classifying');
    let checks = 0;
    const recovered = await runService.recover((run) => {
      checks += 1;
      return run.resultWorkingVersion === 2;
    });
    expect(checks).toBe(1);
    expect(recovered.map((run) => [run.id, run.status])).toEqual([
      [committed.id, 'completed'],
      [pending.id, 'interrupted'],
    ]);
    expect(runs.get(pending.id)).toMatchObject({ errorCode: 'PROCESS_INTERRUPTED' });
    database.close();
  });

  it('persists terminal state across database reopen on the current schema', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-agent-db-'));
    directories.push(directory);
    const path = join(directory, 'app.db');
    const first = setup(path);
    const run = first.service.startRun(input()).run;
    first.runService.transition(run.id, 'classifying');
    first.runService.transition(run.id, 'failed', {
      errorCode: 'PROVIDER_ERROR',
      errorMessage: '模型不可用 token=private-value',
    });
    first.database.close();
    const reopened = new ApplicationDatabase(path);
    expect(new AgentRunRepository(reopened).get(run.id)).toMatchObject({
      status: 'failed',
      errorCode: 'PROVIDER_ERROR',
      errorMessage: '模型不可用 token=[REDACTED]',
    });
    expect(
      reopened.connection
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_meta'")
        .get(),
    ).toBeUndefined();
    reopened.close();
  });
});
