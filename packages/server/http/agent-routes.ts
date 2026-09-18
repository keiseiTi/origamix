import {
  CancelAgentRunRequestSchema,
  CreateAgentRunRequestSchema,
  type AgentRun,
  type CreateAgentRunRequest,
} from '@origamix/shared/protocol/agent';
import type { AgentRunRecord } from '../agent/run-repository';
import { invalid, notFound } from '../errors';
import type { RouteInput, RouteRegistrationContext } from './types';

const publicRun = (run: AgentRunRecord): AgentRun => ({
  version: '1',
  runId: run.id,
  projectId: run.projectId,
  pageId: run.pageId,
  conversationId: run.conversationId,
  userMessageId: run.userMessageId,
  requestId: run.clientRequestId,
  baseWorkingVersion: run.baseWorkingVersion,
  mode: run.mode,
  status: run.status,
  budget: run.budget,
  modelRef: run.modelRef,
  promptVersion: run.promptVersion,
  policyVersion: run.policyVersion,
  toolsetVersion: run.toolsetVersion,
  materialManifestVersion: run.materialManifestVersion,
  ...(run.resultWorkingVersion ? { resultWorkingVersion: run.resultWorkingVersion } : {}),
  ...(run.retryOfRunId ? { retryOfRunId: run.retryOfRunId } : {}),
  createdAt: run.createdAt,
  updatedAt: run.updatedAt,
});

export const registerAgentRoutes = ({ server, input, route }: RouteRegistrationContext): void => {
  if (!input.agent) return;
  const agent = input.agent;
  const requireProjectHeader = (request: RouteInput<unknown>): string => {
    const projectId = String(request.headers['x-origamix-project-id'] ?? '');
    if (!projectId) throw invalid('缺少项目上下文');
    return projectId;
  };
  const requireOwnedRun = (projectId: string, runId: string): AgentRunRecord => {
    const run = agent.runs.get(runId);
    if (run.projectId !== projectId) throw notFound('Agent Run 不存在');
    return run;
  };

  server.get(
    '/api/v1/pages/:pageId/conversations',
    route<void>((request) => {
      const projectId = requireProjectHeader(request);
      return {
        version: '1',
        conversations: agent.conversations.list(projectId, request.params.pageId).map((item) => ({
          version: '1',
          conversationId: item.id,
          projectId: item.projectId,
          pageId: item.pageId,
          title: item.title,
          status: item.status === 'archived' ? ('archived' as const) : ('active' as const),
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
      };
    }),
  );
  server.get(
    '/api/v1/conversations/:conversationId/messages',
    route<void>((request) => {
      const projectId = requireProjectHeader(request);
      const pageId = String(request.headers['x-origamix-page-id'] ?? '');
      if (!pageId) throw invalid('缺少页面上下文');
      const after = Number(request.headers['x-origamix-after-sequence'] ?? -1);
      return {
        version: '1',
        messages: agent.conversations
          .history(
            projectId,
            pageId,
            request.params.conversationId,
            Number.isSafeInteger(after) && after >= -1 ? after : -1,
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
      };
    }),
  );
  server.post(
    '/api/v1/agent/runs',
    { schema: { body: CreateAgentRunRequestSchema } },
    route<CreateAgentRunRequest>(async (request) => {
      const projectId = requireProjectHeader(request);
      if (projectId !== request.body.projectId) throw notFound('项目上下文不匹配');
      const started = await agent.service.start(request.body);
      return {
        version: '1',
        runId: started.run.id,
        conversationId: started.conversationId,
        userMessageId: started.userMessageId,
        status: started.run.status,
      };
    }, 202),
  );
  server.get(
    '/api/v1/agent/runs/:runId',
    route<void>((request) => {
      const projectId = requireProjectHeader(request);
      return { version: '1', run: publicRun(requireOwnedRun(projectId, request.params.runId)) };
    }),
  );
  server.post(
    '/api/v1/agent/runs/:runId/cancel',
    { schema: { body: CancelAgentRunRequestSchema } },
    route<{ version: '1'; requestId: string }>((request) => {
      const projectId = requireProjectHeader(request);
      const run = requireOwnedRun(projectId, request.params.runId);
      const cancelled = agent.service.cancel(run.id, request.body.requestId);
      return {
        version: '1',
        runId: run.id,
        status: cancelled.status === 'cancelled' ? ('cancelled' as const) : ('cancelling' as const),
      };
    }),
  );
  server.get('/api/v1/agent/runs/:runId/events', async (request, reply) => {
    const projectId = String(request.headers['x-origamix-project-id'] ?? '');
    const runId = (request.params as { runId: string }).runId;
    requireOwnedRun(projectId, runId);
    const cursor = Number(
      request.headers['last-event-id'] ??
        (request.query as { afterEventId?: string }).afterEventId ??
        -1,
    );
    reply.hijack();
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
    for (const event of subscription.replay) write(event);
    if (agent.events.isTerminal(runId) && !reply.raw.writableEnded) reply.raw.end();
    const heartbeat = setInterval(() => reply.raw.write(': heartbeat\n\n'), 15_000);
    heartbeat.unref();
    request.raw.on('close', () => {
      clearInterval(heartbeat);
      subscription.close();
    });
  });
};
