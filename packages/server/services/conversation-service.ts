import { nanoid } from 'nanoid';
import type { MessageContent, RunBudget, RunMode } from '@origamix/shared/protocol/agent';
import type { ApplicationDatabase } from '../database/database';
import { conflict, notFound } from '../errors';
import { AgentRunRepository, type AgentRunRecord } from '../repositories/agent-run-repository';
import {
  ConversationRepository,
  type ConversationRecord,
  type StoredMessage,
} from '../repositories/conversation-repository';
import type { ProjectRepository } from '../repositories/project-repository';

export interface StartConversationRunInput {
  projectId: string;
  pageId: string;
  conversationId?: string;
  clientRequestId: string;
  baseRevisionId: string;
  content: MessageContent;
  modelRef: string;
  mode: RunMode;
  budget: RunBudget;
  promptVersion: string;
  policyVersion: string;
  toolsetVersion: string;
  materialManifestVersion: string;
  retryOfRunId?: string;
}

const now = (): string => new Date().toISOString();
const id = (prefix: string): string => `${prefix}_${nanoid()}`;

export class ConversationService {
  constructor(
    private readonly database: ApplicationDatabase,
    private readonly projects: ProjectRepository,
    private readonly conversations: ConversationRepository,
    private readonly runs: AgentRunRepository,
  ) {}

  getOrCreateActive(projectId: string, pageId: string): ConversationRecord {
    this.requirePage(projectId, pageId);
    const active = this.conversations.findActive(projectId, pageId);
    if (active) return active;
    const timestamp = now();
    return this.conversations.create({
      id: id('conversation'),
      projectId,
      pageId,
      title: '新对话',
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  list(projectId: string, pageId: string, limit = 50): ConversationRecord[] {
    this.requirePage(projectId, pageId);
    return this.conversations.list(projectId, pageId, Math.min(Math.max(limit, 1), 100));
  }

  startRun(input: StartConversationRunInput): {
    conversation: ConversationRecord;
    message: StoredMessage;
    run: AgentRunRecord;
    created: boolean;
  } {
    this.requirePage(input.projectId, input.pageId);
    const duplicate = this.runs.findByClientRequest(
      input.projectId,
      input.pageId,
      input.clientRequestId,
    );
    if (duplicate) return this.existingStartResult(duplicate, input);

    let shouldCreateConversation = false;
    let conversation = input.conversationId
      ? this.requireConversation(input.conversationId, input.projectId, input.pageId)
      : this.conversations.findActive(input.projectId, input.pageId);
    if (!conversation) {
      const timestamp = now();
      conversation = {
        id: id('conversation'),
        projectId: input.projectId,
        pageId: input.pageId,
        title: '新对话',
        status: 'active',
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      shouldCreateConversation = true;
    }
    if (input.retryOfRunId) this.requireRetryParent(input.retryOfRunId, conversation);

    const timestamp = now();
    const message: StoredMessage = {
      version: '1',
      messageId: id('message'),
      conversationId: conversation.id,
      role: 'user',
      content: input.content,
      sequence: this.conversations.nextSequence(conversation.id),
      createdAt: timestamp,
      updatedAt: timestamp,
      status: 'completed',
    };
    const run: AgentRunRecord = {
      id: id('run'),
      projectId: input.projectId,
      pageId: input.pageId,
      conversationId: conversation.id,
      userMessageId: message.messageId,
      clientRequestId: input.clientRequestId,
      baseRevisionId: input.baseRevisionId,
      modelRef: input.modelRef,
      mode: input.mode,
      status: 'queued',
      budget: input.budget,
      promptVersion: input.promptVersion,
      policyVersion: input.policyVersion,
      toolsetVersion: input.toolsetVersion,
      materialManifestVersion: input.materialManifestVersion,
      ...(input.retryOfRunId ? { retryOfRunId: input.retryOfRunId } : {}),
      inputTokens: 0,
      outputTokens: 0,
      modelCalls: 0,
      toolCalls: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const db = this.database.connection;
    db.exec('BEGIN IMMEDIATE');
    try {
      if (shouldCreateConversation) this.conversations.create(conversation);
      this.conversations.appendMessage(message);
      this.runs.create(run);
      this.conversations.touch(conversation.id, timestamp);
      db.exec('COMMIT');
      return {
        conversation: { ...conversation, updatedAt: timestamp },
        message,
        run,
        created: true,
      };
    } catch (error) {
      db.exec('ROLLBACK');
      const raced = this.runs.findByClientRequest(
        input.projectId,
        input.pageId,
        input.clientRequestId,
      );
      if (raced) return this.existingStartResult(raced, input);
      throw error;
    }
  }

  checkpointAssistant(runId: string, content: MessageContent): StoredMessage {
    const run = this.requireRun(runId);
    const existing = this.conversations.findAssistantByRun(runId);
    const timestamp = now();
    if (existing) {
      this.conversations.updateMessage(existing.messageId, {
        content,
        status: 'streaming',
        updatedAt: timestamp,
      });
      return { ...existing, content, status: 'streaming', updatedAt: timestamp };
    }
    const message: StoredMessage = {
      version: '1',
      messageId: id('message'),
      conversationId: run.conversationId,
      runId,
      role: 'assistant',
      content,
      sequence: this.conversations.nextSequence(run.conversationId),
      createdAt: timestamp,
      updatedAt: timestamp,
      status: 'streaming',
    };
    return this.conversations.appendMessage(message);
  }

  finishAssistant(runId: string, content: MessageContent): StoredMessage {
    const message = this.checkpointAssistant(runId, content);
    const timestamp = now();
    this.conversations.updateMessage(message.messageId, {
      content,
      status: 'completed',
      updatedAt: timestamp,
    });
    return { ...message, status: 'completed', updatedAt: timestamp };
  }

  failAssistant(runId: string, content: MessageContent, errorCode: string): StoredMessage {
    const message = this.checkpointAssistant(runId, content);
    const timestamp = now();
    this.conversations.updateMessage(message.messageId, {
      content,
      status: 'failed',
      updatedAt: timestamp,
      errorCode,
    });
    return { ...message, status: 'failed', errorCode, updatedAt: timestamp };
  }

  history(
    projectId: string,
    pageId: string,
    conversationId: string,
    afterSequence = -1,
    limit = 100,
  ): StoredMessage[] {
    this.requirePage(projectId, pageId);
    this.requireConversation(conversationId, projectId, pageId);
    return this.conversations.listMessages(conversationId, afterSequence, limit);
  }

  recentHistory(
    projectId: string,
    pageId: string,
    conversationId: string,
    limit = 500,
  ): StoredMessage[] {
    this.requirePage(projectId, pageId);
    this.requireConversation(conversationId, projectId, pageId);
    return this.conversations.listRecentMessages(conversationId, Math.min(Math.max(limit, 1), 500));
  }

  private existingStartResult(run: AgentRunRecord, input: StartConversationRunInput) {
    const storedMessage = this.conversations.getMessage(run.userMessageId);
    if (
      run.baseRevisionId !== input.baseRevisionId ||
      run.conversationId !== (input.conversationId ?? run.conversationId) ||
      run.modelRef !== input.modelRef ||
      run.mode !== input.mode ||
      run.retryOfRunId !== input.retryOfRunId ||
      !storedMessage ||
      JSON.stringify(storedMessage.content) !== JSON.stringify(input.content)
    ) {
      throw conflict('clientRequestId 已用于不同请求');
    }
    const conversation = this.requireConversation(
      run.conversationId,
      input.projectId,
      input.pageId,
    );
    return { conversation, message: storedMessage, run, created: false };
  }

  private requirePage(projectId: string, pageId: string): void {
    if (!this.projects.getProject(projectId)) throw notFound('项目不存在');
    if (!this.projects.getPage(projectId, pageId)) throw notFound('页面不存在或不属于项目');
  }

  private requireConversation(id: string, projectId: string, pageId: string): ConversationRecord {
    const conversation = this.conversations.get(id);
    if (!conversation || conversation.projectId !== projectId || conversation.pageId !== pageId) {
      throw notFound('会话不存在或不属于当前页面');
    }
    return conversation;
  }

  private requireRetryParent(id: string, conversation: ConversationRecord): void {
    const parent = this.runs.get(id);
    if (
      !parent ||
      parent.conversationId !== conversation.id ||
      parent.projectId !== conversation.projectId ||
      parent.pageId !== conversation.pageId
    ) {
      throw notFound('重试来源 Run 不存在或归属不一致');
    }
  }

  private requireRun(id: string): AgentRunRecord {
    const run = this.runs.get(id);
    if (!run) throw notFound('Agent Run 不存在');
    return run;
  }
}
