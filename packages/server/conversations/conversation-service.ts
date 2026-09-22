import { nanoid } from 'nanoid';
import type { AgentRunKind, MessageContent, RunBudget } from '@origamix/shared/protocol/agent';
import type { ApplicationDatabase } from '../database/database';
import { conflict, notFound } from '../errors';
import { AgentRunRepository, type AgentRunRecord } from '../agent/run-repository';
import {
  ConversationRepository,
  type ConversationRecord,
  type StoredMessage,
} from './conversation-repository';
import { ProjectRepository } from '../projects/project-repository';

export interface StartConversationRunInput {
  projectId: string;
  pageId: string;
  conversationId?: string;
  clientRequestId: string;
  baseWorkingVersion: number;
  content: MessageContent;
  modelRef: string;
  runKind: AgentRunKind;
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
    try {
      return this.database.transaction(() =>
        this.startRunInTransaction(input, this.projects, this.conversations, this.runs),
      );
    } catch (error) {
      const raced = this.runs.findByClientRequest(
        input.projectId,
        input.pageId,
        input.clientRequestId,
      );
      if (raced) return this.existingStartResult(raced, input);
      throw error;
    }
  }

  private startRunInTransaction(
    input: StartConversationRunInput,
    projects: ProjectRepository,
    conversations: ConversationRepository,
    runs: AgentRunRepository,
  ): {
    conversation: ConversationRecord;
    message: StoredMessage;
    run: AgentRunRecord;
    created: boolean;
  } {
    this.requirePage(input.projectId, input.pageId, projects);
    const duplicate = runs.findByClientRequest(
      input.projectId,
      input.pageId,
      input.clientRequestId,
    );
    if (duplicate) return this.existingStartResult(duplicate, input, conversations);

    let shouldCreateConversation = false;
    let conversation = input.conversationId
      ? this.requireConversation(input.conversationId, input.projectId, input.pageId, conversations)
      : conversations.findActive(input.projectId, input.pageId);
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
    if (input.retryOfRunId) this.requireRetryParent(input.retryOfRunId, conversation, runs);

    const timestamp = now();
    const message: StoredMessage = {
      version: '1',
      messageId: id('message'),
      conversationId: conversation.id,
      role: 'user',
      content: input.content,
      sequence: conversations.nextSequence(conversation.id),
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
      baseWorkingVersion: input.baseWorkingVersion,
      modelRef: input.modelRef,
      runKind: input.runKind,
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
      repairAttempts: 0,
      recoveredCommit: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    if (shouldCreateConversation) conversations.create(conversation);
    conversations.appendMessage(message);
    runs.create(run);
    conversations.touch(conversation.id, timestamp);
    return { conversation: { ...conversation, updatedAt: timestamp }, message, run, created: true };
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

  private existingStartResult(
    run: AgentRunRecord,
    input: StartConversationRunInput,
    conversations = this.conversations,
  ) {
    const storedMessage = conversations.getMessage(run.userMessageId);
    if (
      run.baseWorkingVersion !== input.baseWorkingVersion ||
      run.conversationId !== (input.conversationId ?? run.conversationId) ||
      run.modelRef !== input.modelRef ||
      run.runKind !== input.runKind ||
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
      conversations,
    );
    return { conversation, message: storedMessage, run, created: false };
  }

  private requirePage(projectId: string, pageId: string, projects = this.projects): void {
    if (!projects.getProject(projectId)) throw notFound('项目不存在');
    if (!projects.getPage(projectId, pageId)) throw notFound('页面不存在或不属于项目');
  }

  private requireConversation(
    id: string,
    projectId: string,
    pageId: string,
    conversations = this.conversations,
  ): ConversationRecord {
    const conversation = conversations.get(id);
    if (!conversation || conversation.projectId !== projectId || conversation.pageId !== pageId) {
      throw notFound('会话不存在或不属于当前页面');
    }
    return conversation;
  }

  private requireRetryParent(id: string, conversation: ConversationRecord, runs = this.runs): void {
    const parent = runs.get(id);
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
