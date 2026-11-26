import { agentTargetFields, type AgentEvent } from '@origamix/shared';
import type { ServerResponse } from 'node:http';
import type { FastifyInstance } from 'fastify';
import type { AgentEventBroker, AgentEventSubscription } from '../agent/event-broker';
import type { AgentRunRecord } from '../agent/run-repository';
import type { DiagnosticLogger } from '../logging/logger';
import { ApiError } from '../errors';

export const registerAgentEventRoutes = (
  server: FastifyInstance,
  events: AgentEventBroker,
  requireOwnedRun: (projectId: string, runId: string) => Promise<AgentRunRecord>,
  logger?: DiagnosticLogger,
): void => {
  const streams = new Set<ServerResponse>();
  server.addHook('preClose', async () => {
    for (const stream of streams) stream.end();
  });
  server.get(`/api/v1/projects/:projectId/agent/runs/:runId/events`, async (request, reply) => {
    const { projectId, runId } = request.params as { projectId: string; runId: string };
    const durable = await requireOwnedRun(projectId, runId);
    if (streams.size >= 256) throw new ApiError('事件订阅过多，请稍后重试', 429);
    const cursor = Number(request.headers['last-event-id'] ?? -1);
    const after =
      Number.isSafeInteger(cursor) && cursor < Number.MAX_SAFE_INTEGER ? Math.max(-1, cursor) : -1;
    const terminal = ['completed', 'failed', 'cancelled', 'interrupted'].includes(durable.status);
    let subscription: AgentEventSubscription | undefined;
    const write = (event: AgentEvent): void => {
      if (reply.raw.destroyed || reply.raw.writableEnded) return;
      const accepted = reply.raw.write(
        `id: ${event.eventId}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
      );
      if (
        !accepted ||
        ['run.completed', 'run.failed', 'run.cancelled', 'run.interrupted'].includes(event.type)
      ) {
        subscription?.close();
        reply.raw.end();
      }
    };
    if (!terminal) subscription = events.subscribe(runId, after, write);
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
    streams.add(reply.raw);
    const heartbeat = setInterval(() => {
      if (!reply.raw.destroyed && !reply.raw.writableEnded && !reply.raw.write(': heartbeat\n\n')) {
        subscription?.close();
        reply.raw.end();
      }
    }, 15_000);
    heartbeat.unref();
    reply.raw.on('close', () => {
      logger?.debug({
        event: 'agent.sse.closed',
        requestId: request.id,
        runId,
        outcome: reply.raw.writableFinished ? 'ended' : 'disconnected',
        durationMs: Math.round(reply.elapsedTime),
      });
      streams.delete(reply.raw);
      clearInterval(heartbeat);
      subscription?.close();
    });
    if (terminal) {
      write({
        version: '1',
        eventId: after + 1,
        sequence: after + 1,
        type: `run.${durable.status}`,
        runId,
        ...agentTargetFields(durable.projectId, durable.pageId),
        requestId: durable.clientRequestId,
        occurredAt: durable.updatedAt,
        payload:
          durable.status === 'completed'
            ? {
                status: 'completed',
                outcome: durable.outcome ?? 'answered_only',
                ...(durable.resultWorkingVersion
                  ? { resultWorkingVersion: durable.resultWorkingVersion }
                  : {}),
              }
            : durable.status === 'failed'
              ? {
                  status: 'failed',
                  errorCode: durable.errorCode ?? 'INTERNAL_ERROR',
                  safeMessage: 'Agent 请求未完成，请读取运行记录后重试',
                }
              : { status: durable.status },
      });
    }
    for (const event of subscription?.replay ?? []) write(event);
    if (events.isTerminal(runId) && !reply.raw.writableEnded) reply.raw.end();
  });
};
