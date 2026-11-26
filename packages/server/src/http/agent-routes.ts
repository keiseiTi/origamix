import {
  CancelAgentRunRequestSchema,
  agentTargetFields,
  resolveAgentTarget,
  ClarificationResultSchema,
  type AgentRun,
  CreateAgentRunRequestSchema,
  ConversationIdSchema,
} from '@origamix/shared';
import { Value } from '@sinclair/typebox/value';
import { Type, type Static } from '@sinclair/typebox';

import { PageScopeSchema, ProjectIdSchema } from './body-schemas';
import type { AgentRunRecord } from '../agent/run-repository';
import { ApiError, notFound } from '../errors';
import { registerAgentEventRoutes } from './agent-event-routes';
import type { RouteRegistrationContext } from './types';

const publicRun = (run: AgentRunRecord): AgentRun => ({
  version: '1',
  runId: run.id,
  projectId: run.projectId,
  ...agentTargetFields(run.projectId, run.pageId),
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
  const requireOwnedRun = async (projectId: string, runId: string): Promise<AgentRunRecord> => {
    const run = await agent.runs.get(runId);
    if (run.projectId !== projectId || !run.pageId) throw notFound('Agent Run 不存在');
    return run;
  };

  const ConversationListBodySchema = Type.Object(
    {
      ...PageScopeSchema.properties,
      offset: Type.Optional(Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER - 50 })),
    },
    { additionalProperties: false },
  );
  const MessageListBodySchema = Type.Object(
    {
      ...PageScopeSchema.properties,
      conversationId: ConversationIdSchema,
      afterSequence: Type.Optional(Type.Integer({ minimum: -1, maximum: Number.MAX_SAFE_INTEGER })),
      beforeSequence: Type.Optional(Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER })),
    },
    { additionalProperties: false, not: { required: ['afterSequence', 'beforeSequence'] } },
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
    '/api/v1/agent/pages/activity',
    { schema: { body: PageScopeSchema } },
    route<Static<typeof PageScopeSchema>>(async ({ body }) => ({
      version: '1',
      ...(await agent.service.pageActivity(body.projectId, body.pageId)),
    })),
  );
  server.post(
    '/api/v1/agent/conversations/list',
    { schema: { body: ConversationListBodySchema } },
    route<Static<typeof ConversationListBodySchema>>(async ({ body }) => {
      const offset = body.offset ?? 0;
      const items = await agent.conversations.list(body.projectId, body.pageId, 51, offset);
      return {
        version: '1',
        ...(items.length > 50 ? { nextOffset: offset + 50 } : {}),
        conversations: items.slice(0, 50).map((item) => ({
          version: '1',
          conversationId: item.id,
          projectId: item.projectId,
          ...(item.pageId ? { pageId: item.pageId } : {}),
          target: agentTargetFields(item.projectId, item.pageId).target,
          title: item.title,
          status: item.status === 'archived' ? ('archived' as const) : ('active' as const),
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
      };
    }),
  );
  server.post(
    '/api/v1/agent/messages/list',
    { schema: { body: MessageListBodySchema } },
    route<Static<typeof MessageListBodySchema>>(async ({ body }) => {
      const { projectId, pageId, conversationId, afterSequence, beforeSequence } = body;
      const limit = 50;
      const recent = afterSequence === undefined;
      const items = recent
        ? await agent.conversations.recentHistory(
            projectId,
            pageId,
            conversationId,
            limit + 1,
            beforeSequence,
          )
        : await agent.conversations.history(
            projectId,
            pageId,
            conversationId,
            afterSequence,
            limit + 1,
          );
      const messages = recent ? items.slice(-limit) : items.slice(0, limit);
      return {
        version: '1',
        hasMore: items.length > limit,
        messages: messages.map(
          ({ version, messageId, conversationId, runId, role, content, sequence, createdAt }) => ({
            version,
            messageId,
            conversationId,
            ...(runId ? { runId } : {}),
            role,
            content,
            sequence,
            createdAt,
          }),
        ),
      };
    }),
  );
  server.post(
    `/api/v1/agent/runs/create`,
    { schema: { body: CreateAgentRunRequestSchema } },
    route<Static<typeof CreateAgentRunRequestSchema>>(async (request) => {
      const target = resolveAgentTarget(request.body);
      if (!target || target.kind !== 'page') throw new ApiError('Agent 请求目标与接口不一致', 400);
      const started = await agent.service.start(request.body, request.requestId);
      return {
        version: '1',
        runId: started.run.id,
        run: publicRun(started.run),
        conversationId: started.conversationId,
        userMessageId: started.userMessageId,
        runKind: started.run.runKind,
        status: started.run.status,
      };
    }, 202),
  );
  server.post(
    `/api/v1/agent/runs/get`,
    { schema: { body: RunScopeSchema } },
    route<Static<typeof RunScopeSchema>>(async (request) => ({
      version: '1',
      run: publicRun(await requireOwnedRun(request.body.projectId, request.body.runId)),
    })),
  );
  server.post(
    `/api/v1/agent/runs/cancel`,
    { schema: { body: CancelRunBodySchema } },
    route<Static<typeof CancelRunBodySchema>>(async (request) => {
      const run = await requireOwnedRun(request.body.projectId, request.body.runId);
      const cancelled = await agent.service.cancel(run.id, request.body.requestId);
      return {
        version: '1',
        runId: run.id,
        status: ['cancelled', 'committing', 'completed', 'failed', 'interrupted'].includes(
          cancelled.status,
        )
          ? cancelled.status
          : ('cancelling' as const),
      };
    }),
  );
  registerAgentEventRoutes(server, agent.events, requireOwnedRun, input.logger);
};
