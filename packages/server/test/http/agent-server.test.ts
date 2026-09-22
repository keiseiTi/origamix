import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { AgentEventBroker } from '../../agent/event-broker';
import { ApplicationDatabase } from '../../database/database';
import { AgentRunRepository } from '../../agent/run-repository';
import { ConversationRepository } from '../../conversations/conversation-repository';
import { ProjectRepository } from '../../projects/project-repository';
import { AgentRunService } from '../../agent/run-service';
import { ConversationService } from '../../conversations/conversation-service';
import { ProjectService } from '../../projects/project-service';
import type { AgentService } from '../../agent/agent-service';
import { createHttpServer } from '../../http/server';
import type { CreateAgentRunRequest } from '@origamix/shared/protocol/agent';

const templatePath = fileURLToPath(new URL('../../../template', import.meta.url));
const auth = { authorization: 'Bearer desktop-token', 'x-origamix-service': 'service-instance' };

const setup = () => {
  const database = new ApplicationDatabase(':memory:');
  const projects = new ProjectRepository(database);
  const timestamp = new Date().toISOString();
  projects.reconcile(
    {
      id: 'project_a',
      path: '/tmp/a',
      name: 'A',
      status: 0,
      createdAt: timestamp,
      lastOpenedAt: timestamp,
    },
    [
      {
        id: 'page_a',
        projectId: 'project_a',
        slug: 'a',
        name: 'A',
        relativePath: 'pages/a',
        status: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
  );
  projects.reconcile(
    {
      id: 'project_b',
      path: '/tmp/b',
      name: 'B',
      status: 0,
      createdAt: timestamp,
      lastOpenedAt: timestamp,
    },
    [],
  );
  const conversations = new ConversationRepository(database);
  const runs = new AgentRunRepository(database);
  const conversationService = new ConversationService(database, projects, conversations, runs);
  const runService = new AgentRunService(runs);
  const events = new AgentEventBroker();
  const dispatch = vi.fn();
  const service = {
    start: vi.fn(async (request: CreateAgentRunRequest) => {
      const started = conversationService.startRun({
        ...request,
        modelRef: 'fake/test',
        runKind: 'page_assistant',
        budget: {
          maxModelCalls: 1,
          maxToolCalls: 1,
          maxOutputTokens: 1_000,
          maxDurationMs: 1_000,
          maxSchemaBytes: 10_000,
          maxRepairAttempts: 0,
        },
        promptVersion: '1',
        policyVersion: '1',
        toolsetVersion: '1',
        materialManifestVersion: 'test',
      });
      if (started.created) {
        events.publish({
          type: 'run.queued',
          runId: started.run.id,
          pageId: started.run.pageId,
          requestId: started.run.clientRequestId,
          payload: { status: started.run.status },
        });
        dispatch();
      }
      return {
        run: started.run,
        conversationId: started.conversation.id,
        userMessageId: started.message.messageId,
      };
    }),
    get: (runId: string) => runService.get(runId),
    cancel: (runId: string) => runService.cancel(runId),
  } as unknown as AgentService;
  const server = createHttpServer({
    desktopToken: 'desktop-token',
    serviceInstanceId: 'service-instance',
    projects,
    projectService: new ProjectService(projects, templatePath),
    agent: { conversations: conversationService, runs: runService, events, service },
  });
  return { database, server, events, dispatch };
};

const payload = {
  version: '1',
  projectId: 'project_a',
  pageId: 'page_a',
  clientRequestId: 'request-1',
  baseWorkingVersion: 1,
  content: { version: '1', blocks: [{ type: 'text', text: '创建表单' }] },
};

describe('Agent HTTP API', () => {
  it('acknowledges once with 202 and enforces project ownership', async () => {
    const fixture = setup();
    try {
      const headers = { ...auth, 'x-origamix-project-id': 'project_a' };
      const first = await fixture.server.inject({
        method: 'POST',
        url: '/api/v1/agent/runs',
        headers,
        payload,
      });
      const duplicate = await fixture.server.inject({
        method: 'POST',
        url: '/api/v1/agent/runs',
        headers,
        payload,
      });
      expect(first.statusCode).toBe(202);
      expect(duplicate.statusCode).toBe(202);
      expect(duplicate.json().data.runId).toBe(first.json().data.runId);
      expect(fixture.dispatch).toHaveBeenCalledTimes(1);
      const runId = first.json().data.runId as string;
      const denied = await fixture.server.inject({
        method: 'GET',
        url: `/api/v1/agent/runs/${runId}`,
        headers: { ...auth, 'x-origamix-project-id': 'project_b' },
      });
      expect(denied.statusCode).toBe(404);
      const cancel = await fixture.server.inject({
        method: 'POST',
        url: `/api/v1/agent/runs/${runId}/cancel`,
        headers,
        payload: { version: '1', requestId: 'cancel-1' },
      });
      expect(cancel.json()).toMatchObject({ success: true, data: { runId, status: 'cancelling' } });
    } finally {
      await fixture.server.close();
      fixture.database.close();
    }
  });

  it('serves authoritative history and bounded SSE replay', async () => {
    const fixture = setup();
    try {
      const headers = { ...auth, 'x-origamix-project-id': 'project_a' };
      const created = await fixture.server.inject({
        method: 'POST',
        url: '/api/v1/agent/runs',
        headers,
        payload,
      });
      const { runId, conversationId } = created.json().data as {
        runId: string;
        conversationId: string;
      };
      const history = await fixture.server.inject({
        method: 'GET',
        url: `/api/v1/conversations/${conversationId}/messages`,
        headers: { ...headers, 'x-origamix-page-id': 'page_a' },
      });
      expect(history.json().data.messages).toHaveLength(1);
      fixture.events.publish({
        type: 'run.completed',
        runId,
        pageId: 'page_a',
        requestId: 'request-1',
        payload: {},
      });
      const stream = await fixture.server.inject({
        method: 'GET',
        url: `/api/v1/agent/runs/${runId}/events`,
        headers,
      });
      expect(stream.statusCode).toBe(200);
      expect(stream.headers['content-type']).toContain('text/event-stream');
      expect(stream.payload).toContain('event: run.queued');
      expect(stream.payload).toContain('event: run.completed');
    } finally {
      await fixture.server.close();
      fixture.database.close();
    }
  });
});
