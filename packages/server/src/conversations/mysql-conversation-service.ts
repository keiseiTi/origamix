import type { Pool } from 'mysql2/promise';
import { nanoid } from 'nanoid';
import type { MessageContent } from '@origamix/shared';
import { conflict, notFound } from '../errors';
import type { MysqlProjectService } from '../projects/mysql-project-service';
import { MysqlAgentRunRepository } from '../agent/mysql-agent-repository';
import { requireAgentTarget } from '../agent/agent-target';
import { getWorkingSchemaState } from '../schema/schema-service';
import { inWebTransaction } from '../database/mysql-web';
import type { AgentConversations } from '../agent/persistence';
import type { ConversationRecord, StoredMessage } from './conversation-repository';
import {
  assertMatchingRunRequest,
  createQueuedRun,
  conversationTitle,
  type StartConversationRunInput,
} from './conversation-service';
import { MysqlConversationRepository } from './mysql-conversation-repository';

const scopedConversation = (
  conversation: ConversationRecord | undefined,
  projectId: string,
  pageId: string,
) => {
  if (
    !conversation ||
    conversation.projectId !== projectId ||
    conversation.pageId !== pageId ||
    conversation.status === 'deleted'
  )
    throw notFound('会话不存在或不属于当前页面');
  return conversation;
};

export class MysqlConversationService implements AgentConversations {
  private readonly repository: MysqlConversationRepository;
  constructor(
    private readonly pool: Pool,
    private readonly projects: MysqlProjectService,
    private readonly runs: MysqlAgentRunRepository,
  ) {
    this.repository = new MysqlConversationRepository(pool);
  }

  async startRun(input: StartConversationRunInput) {
    const { pageId } = requireAgentTarget(input);
    return this.projects.withAgentPage(input.projectId, pageId, async (connection, page) => {
      const conversations = new MysqlConversationRepository(connection);
      const runs = new MysqlAgentRunRepository(connection);
      const duplicate = await runs.findByClientRequest(
        input.projectId,
        pageId,
        input.clientRequestId,
      );
      if (duplicate) {
        const message = await conversations.findMessage(duplicate.userMessageId);
        assertMatchingRunRequest(duplicate, input, message);
        const conversation = scopedConversation(
          await conversations.get(duplicate.conversationId),
          input.projectId,
          pageId,
        );
        return { conversation, message, run: duplicate, created: false };
      }
      const current = await getWorkingSchemaState(page);
      if (current.workingVersion !== input.baseWorkingVersion)
        throw conflict('页面版本已变化，请刷新后重试');
      const active = await runs.listActive();
      if (active.some((run) => run.projectId === input.projectId && run.pageId === pageId))
        throw conflict('当前页面已有 Agent 正在运行，请等待完成或先取消');
      if (active.length >= 4) throw conflict('Agent 并发已达上限，请等待其他页面完成');

      const timestamp = new Date().toISOString();
      let conversation = input.conversationId
        ? scopedConversation(
            await conversations.get(input.conversationId, true),
            input.projectId,
            pageId,
          )
        : undefined;
      if (!conversation) {
        conversation = {
          id: `conversation_${nanoid()}`,
          projectId: input.projectId,
          pageId,
          title: conversationTitle(input.content),
          status: 'active',
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        await conversations.insert(conversation);
      }
      if (input.retryOfRunId) {
        const parent = await runs.get(input.retryOfRunId);
        if (
          !parent ||
          parent.conversationId !== conversation.id ||
          parent.projectId !== input.projectId ||
          parent.pageId !== pageId
        )
          throw notFound('重试来源 Run 不存在或归属不一致');
      }
      const runId = `run_${nanoid()}`;
      const message: StoredMessage = {
        version: '1',
        messageId: `message_${nanoid()}`,
        conversationId: conversation.id,
        runId,
        role: 'user',
        content: input.content,
        sequence: await conversations.nextSequence(conversation.id),
        status: 'completed',
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const run = createQueuedRun(input, runId, conversation.id, message.messageId, timestamp);
      await runs.create(run);
      await conversations.append(message);
      conversation = { ...conversation, updatedAt: timestamp };
      await conversations.touch(conversation);
      return { conversation, message, run, created: true };
    });
  }

  async list(projectId: string, pageId: string | undefined, limit = 50, offset = 0) {
    if (!pageId || !(await this.projects.agentProjects.getPage(projectId, pageId)))
      throw notFound('页面不存在');
    return this.repository.list(projectId, pageId, Math.min(Math.max(limit, 1), 100), offset);
  }

  async history(
    projectId: string,
    pageId: string | undefined,
    conversationId: string,
    after = -1,
    limit = 100,
  ) {
    if (!pageId || !(await this.projects.agentProjects.getPage(projectId, pageId)))
      throw notFound('页面不存在');
    scopedConversation(await this.repository.get(conversationId), projectId, pageId);
    return this.repository.listMessages(conversationId, after, Math.min(Math.max(limit, 1), 500));
  }

  async recentHistory(
    projectId: string,
    pageId: string | undefined,
    conversationId: string,
    limit = 500,
    beforeSequence?: number,
  ) {
    if (!pageId || !(await this.projects.agentProjects.getPage(projectId, pageId)))
      throw notFound('页面不存在');
    scopedConversation(await this.repository.get(conversationId), projectId, pageId);
    return this.repository.listRecentMessages(
      conversationId,
      Math.min(Math.max(limit, 1), 500),
      beforeSequence,
    );
  }

  listMessages = (id: string, after = -1, limit = 100) =>
    this.repository.listMessages(id, after, limit);
  listRecentMessages = (id: string, limit = 100) => this.repository.listRecentMessages(id, limit);

  private async writeAssistant(runId: string, content: MessageContent, errorCode?: string) {
    const run = await this.runs.get(runId);
    if (!run) throw notFound('Agent Run 不存在');
    return inWebTransaction(this.pool, async (connection) => {
      const repository = new MysqlConversationRepository(connection);
      const conversation = scopedConversation(
        await repository.get(run.conversationId, true),
        run.projectId,
        run.pageId,
      );
      const existing = await repository.findAssistant(runId);
      const timestamp = new Date().toISOString();
      const message: StoredMessage = {
        version: '1',
        messageId: existing?.messageId ?? `message_${nanoid()}`,
        conversationId: conversation.id,
        runId,
        role: 'assistant',
        content,
        sequence: existing?.sequence ?? (await repository.nextSequence(conversation.id)),
        status: errorCode ? 'failed' : 'completed',
        ...(errorCode ? { errorCode } : {}),
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };
      return existing ? repository.replace(message) : repository.append(message);
    });
  }

  finishAssistant = (runId: string, content: MessageContent) => this.writeAssistant(runId, content);
  failAssistant = (runId: string, content: MessageContent, code: string) =>
    this.writeAssistant(runId, content, code);
}
