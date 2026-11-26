import type { AgentRunRepository } from './run-repository';
import type { ConversationService } from '../conversations/conversation-service';
import type { ProjectRepository } from '../projects/project-repository';
import type { SchemaPageRef } from '../schema/schema-contracts';

type AwaitableMethods<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Result
    ? (...args: Args) => Result | Promise<Result>
    : never;
};

export type AgentRunStore = AwaitableMethods<
  Pick<
    AgentRunRepository,
    'get' | 'findByClientRequest' | 'listActive' | 'pageActivity' | 'updateStatus' | 'updateMetrics'
  >
>;
export type AgentConversations = AwaitableMethods<
  Pick<
    ConversationService,
    'startRun' | 'list' | 'history' | 'recentHistory' | 'finishAssistant' | 'failAssistant'
  >
>;
export type AgentProjects = AwaitableMethods<Pick<ProjectRepository, 'getProject' | 'getPage'>>;

export type AgentSchemaPage = (projectId: string, pageId: string) => SchemaPageRef;
