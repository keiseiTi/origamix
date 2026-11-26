import { requireAgentTarget } from '../agent/agent-target';
import { nanoid } from 'nanoid';
import {
  equalJson,
  type AgentRunKind,
  type MessageContent,
  type RunBudget,
  type AgentTarget,
} from '@origamix/shared';
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
  pageId?: string;
  target?: AgentTarget;
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

export const conversationTitle = (content: MessageContent): string => {
  const text = content.blocks.find((block) => block.type === 'text')?.text ?? '';
  const characters = Array.from(text.trim().replace(/\s+/g, ' '));
  return characters.slice(0, 40).join('') + (characters.length > 40 ? '…' : '') || '新对话';
};

export const createQueuedRun = (
  input: StartConversationRunInput,
  runId: string,
  conversationId: string,
  messageId: string,
  timestamp: string,
): AgentRunRecord => ({
  id: runId,
  projectId: input.projectId,
  pageId: requireAgentTarget(input).pageId,
  conversationId: conversationId,
  userMessageId: messageId,
  clientRequestId: input.clientRequestId,
  ...(!input.conversationId ? { newConversation: true } : {}),
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
});
export const assertMatchingRunRequest: (
  run: AgentRunRecord,
  input: StartConversationRunInput,
  storedMessage: StoredMessage | undefined,
) => asserts storedMessage is StoredMessage = (run, input, storedMessage) => {
  if (
    run.baseWorkingVersion !== input.baseWorkingVersion ||
    (run.newConversation ? undefined : run.conversationId) !== input.conversationId ||
    run.modelRef !== input.modelRef ||
    run.runKind !== input.runKind ||
    run.retryOfRunId !== input.retryOfRunId ||
    !storedMessage ||
    !equalJson(storedMessage.content, input.content)
  ) {
    throw conflict('clientRequestId 已用于不同请求');
  }
};

export class ConversationService {
  constructor(
    private readonly database: ApplicationDatabase,
    private readonly projects: ProjectRepository,
    private readonly conversations: ConversationRepository,
    private readonly runs: AgentRunRepository,
  ) {}

  list(
    projectId: string,
    pageId: string | undefined,
    limit = 50,
    offset = 0,
  ): ConversationRecord[] {
    this.requirePage(projectId, pageId);
    return this.conversations.list(projectId, pageId, Math.min(Math.max(limit, 1), 100), offset);
  }

  startRun(input: StartConversationRunInput): {
    conversation: ConversationRecord;
    message: StoredMessage;
    run: AgentRunRecord;
    created: boolean;
  } {
    requireAgentTarget(input);
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

    let conversation = input.conversationId
      ? this.requireConversation(input.conversationId, input.projectId, input.pageId, conversations)
      : undefined;
    if (!conversation) {
      const timestamp = now();
      conversation = conversations.create({
        id: '',
        projectId: input.projectId,
        pageId: requireAgentTarget(input).pageId,
        title: conversationTitle(input.content),
        status: 'active',
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
    if (input.retryOfRunId) this.requireRetryParent(input.retryOfRunId, conversation, runs);

    const timestamp = now();
    const runId = id('run');
    const message: StoredMessage = conversations.appendMessage({
      version: '1',
      messageId: '',
      conversationId: conversation.id,
      role: 'user',
      content: input.content,
      sequence: conversations.nextSequence(conversation.id),
      createdAt: timestamp,
      updatedAt: timestamp,
      status: 'completed',
    });
    const run = createQueuedRun(input, runId, conversation.id, message.messageId, timestamp);

    runs.create(run);
    conversations.bindMessageRun(message.messageId, runId);
    conversations.touch(conversation.id, timestamp);
    return {
      conversation: { ...conversation, updatedAt: timestamp },
      message: { ...message, runId },
      run,
      created: true,
    };
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
      messageId: '',
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
    pageId: string | undefined,
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
    pageId: string | undefined,
    conversationId: string,
    limit = 500,
    beforeSequence?: number,
  ): StoredMessage[] {
    this.requirePage(projectId, pageId);
    this.requireConversation(conversationId, projectId, pageId);
    return this.conversations.listRecentMessages(
      conversationId,
      Math.min(Math.max(limit, 1), 500),
      beforeSequence,
    );
  }

  private existingStartResult(
    run: AgentRunRecord,
    input: StartConversationRunInput,
    conversations = this.conversations,
  ) {
    const storedMessage = conversations.getMessage(run.userMessageId);
    assertMatchingRunRequest(run, input, storedMessage);
    const conversation = this.requireConversation(
      run.conversationId,
      input.projectId,
      input.pageId,
      conversations,
    );
    return { conversation, message: storedMessage, run, created: false };
  }

  private requirePage(
    projectId: string,
    pageId: string | undefined,
    projects = this.projects,
  ): void {
    if (!projects.getProject(projectId)) throw notFound('项目不存在');
    if (!pageId || !projects.getPage(projectId, pageId)) throw notFound('页面不存在或不属于项目');
  }

  private requireConversation(
    id: string,
    projectId: string,
    pageId: string | undefined,
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
