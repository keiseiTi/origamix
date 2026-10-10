import {
  CancelAgentRunRequestSchema,
  ClarificationResultSchema,
  type AgentRun,
  CreateAgentRunRequestSchema,
} from '@origamix/shared/protocol/agent';
import { Value } from '@sinclair/typebox/value';
import { Type, type Static } from '@sinclair/typebox';
import { ConversationIdSchema } from '@origamix/shared/protocol/agent';
import { PageScopeSchema, ProjectIdSchema } from './body-schemas';
import type { AgentRunRecord } from '../agent/run-repository';
import { notFound } from '../errors';
import type { RouteRegistrationContext } from './types';

const publicRun = (run: AgentRunRecord): AgentRun => ({
  version: '1',
  runId: run.id,
  projectId: run.projectId,
  pageId: run.pageId,
  conversationId: run.conversationId,
  userMessageId: run.userMessageId,
  requestId: run.clientRequestId,
  baseWorkingVersion: run.baseWorkingVersion,
  runKind: run.runKind,
  status: run.status,
  budget: run.budget,
  modelRef: run.modelRef,
  promptVersion: run.promptVersion,
  policyVersion: run.policyVersion,
  toolsetVersion: run.toolsetVersion,
  materialManifestVersion: run.materialManifestVersion,
  ...(run.outcome ? { outcome: run.outcome } : {}),
  ...(run.outcome === 'needs_clarification' &&
  run.outcomeJson &&
  Value.Check(ClarificationResultSchema, run.outcomeJson)
    ? { clarification: run.outcomeJson as AgentRun['clarification'] }
    : {}),
  repairAttempts: run.repairAttempts,
  ...(run.resultWorkingVersion ? { resultWorkingVersion: run.resultWorkingVersion } : {}),
  ...(run.resultWorkingHash ? { resultWorkingHash: run.resultWorkingHash } : {}),
  ...(run.retryOfRunId ? { retryOfRunId: run.retryOfRunId } : {}),
  createdAt: run.createdAt,
  updatedAt: run.updatedAt,
});

export const registerAgentRoutes = ({ server, input, route }: RouteRegistrationContext): void => {
  if (!input.agent) return;
  const agent = input.agent;
  const requireOwnedRun = (projectId: string, runId: string): AgentRunRecord => {
    const run = agent.runs.get(runId);
    if (run.projectId !== projectId) throw notFound('Agent Run 不存在');
    return run;
  };

  const ConversationScopeSchema = Type.Object(
    { ...PageScopeSchema.properties, conversationId: ConversationIdSchema },
    { additionalProperties: false },
  );
  const MessageListBodySchema = Type.Object(
    {
      ...ConversationScopeSchema.properties,
      afterSequence: Type.Optional(Type.Integer({ minimum: -1 })),
    },
    { additionalProperties: false },
  );
  const RunScopeSchema = Type.Object(
    { projectId: ProjectIdSchema, runId: Type.String({ pattern: '^run_[A-Za-z0-9_-]+$' }) },
    { additionalProperties: false },
  );
  const CancelRunBodySchema = Type.Object(
    { ...RunScopeSchema.properties, ...CancelAgentRunRequestSchema.properties },
    { additionalProperties: false },
  );

  server.post(
    '/api/v1/agent/conversations/list',
    { schema: { body: PageScopeSchema } },
    route<Static<typeof PageScopeSchema>>((request) => ({
      version: '1',
      conversations: agent.conversations
        .list(request.body.projectId, request.body.pageId)
        .map((item) => ({
          version: '1',
          conversationId: item.id,
          projectId: item.projectId,
          pageId: item.pageId,
          title: item.title,
          status: item.status === 'archived' ? ('archived' as const) : ('active' as const),
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
    })),
  );
  server.post(
    '/api/v1/agent/messages/list',
    { schema: { body: MessageListBodySchema } },
    route<Static<typeof MessageListBodySchema>>((request) => ({
      version: '1',
      messages: agent.conversations
        .history(
          request.body.projectId,
          request.body.pageId,
          request.body.conversationId,
          request.body.afterSequence ?? -1,
        )
        .map((message) => ({
          version: message.version,
          messageId: message.messageId,
          conversationId: message.conversationId,
          ...(message.runId ? { runId: message.runId } : {}),
          role: message.role,
          content: message.content,
          sequence: message.sequence,
          createdAt: message.createdAt,
        })),
    })),
  );
  server.post(
    '/api/v1/agent/runs/create',
    { schema: { body: CreateAgentRunRequestSchema } },
    route<Static<typeof CreateAgentRunRequestSchema>>(async (request) => {
      const started = await agent.service.start(request.body);
      return {
        version: '1',
        runId: started.run.id,
        run: publicRun(started.run),
        conversationId: started.conversationId,
        userMessageId: started.userMessageId,
        runKind: 'page_assistant',
        status: started.run.status,
      };
    }, 202),
  );
  server.post(
    '/api/v1/agent/runs/get',
    { schema: { body: RunScopeSchema } },
    route<Static<typeof RunScopeSchema>>((request) => ({
      version: '1',
      run: publicRun(requireOwnedRun(request.body.projectId, request.body.runId)),
    })),
  );
  server.post(
    '/api/v1/agent/runs/cancel',
    { schema: { body: CancelRunBodySchema } },
    route<Static<typeof CancelRunBodySchema>>((request) => {
      const run = requireOwnedRun(request.body.projectId, request.body.runId);
      const cancelled = agent.service.cancel(run.id, request.body.requestId);
      return {
        version: '1',
        runId: run.id,
        status:
          cancelled.status === 'cancelled' || cancelled.status === 'committing'
            ? cancelled.status
            : ('cancelling' as const),
      };
    }),
  );
  server.get('/api/v1/projects/:projectId/agent/runs/:runId/events', async (request, reply) => {
    const { projectId, runId } = request.params as { projectId: string; runId: string };
    requireOwnedRun(projectId, runId);
    const cursor = Number(
      request.headers['last-event-id'] ??
        (request.query as { afterEventId?: string }).afterEventId ??
        -1,
    );
    reply.hijack();
    // Hijacked responses bypass Fastify's normal header serialization. Copy the
    // authenticated Origin/CORS headers installed by the request boundary.
    for (const [name, value] of Object.entries(reply.getHeaders())) {
      if (value !== undefined) reply.raw.setHeader(name, value);
    }
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    const write = (event: import('@origamix/shared/protocol/agent').AgentEvent): void => {
      reply.raw.write(
        `id: ${event.eventId}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
      );
      if (
        event.type.startsWith('run.') &&
        ['completed', 'failed', 'cancelled', 'interrupted'].includes(event.type.slice(4))
      ) {
        subscription.close();
        reply.raw.end();
      }
    };
    const subscription = agent.events.subscribe(
      runId,
      Number.isSafeInteger(cursor) ? cursor : -1,
      write,
    );
    const heartbeat = setInterval(() => reply.raw.write(': heartbeat\n\n'), 15_000);
    heartbeat.unref();
    reply.raw.on('close', () => {
      clearInterval(heartbeat);
      subscription.close();
    });
    for (const event of subscription.replay) write(event);
    if (agent.events.isTerminal(runId) && !reply.raw.writableEnded) reply.raw.end();
  });
};
