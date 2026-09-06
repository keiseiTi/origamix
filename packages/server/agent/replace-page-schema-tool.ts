import { createHash } from 'node:crypto';
import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { PageSchema, type OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import type { AgentRunRepository } from '../repositories/agent-run-repository';
import type { ProjectRepository } from '../repositories/project-repository';
import { conflict, invalid, notFound } from '../errors';
import { commitSchema } from '../services/schema-service';
import { AgentEngineError, type AgentEngineTool } from './agent-engine';

export interface ReplacePageSchemaToolContext {
  runId: string;
  messageId: string;
  projectId: string;
  pageId: string;
  baseRevisionId: string;
  maxSchemaBytes: number;
}

export interface ReplacePageSchemaToolDependencies {
  projects: ProjectRepository;
  runs: AgentRunRepository;
}

const parameters = Type.Object({ schema: PageSchema }, { additionalProperties: false });

function assertNotCancelled(signal: AbortSignal): void {
  if (signal.aborted) throw new AgentEngineError('CANCELLED', '页面修改已取消');
}

export function createReplacePageSchemaTool(
  dependencies: ReplacePageSchemaToolDependencies,
  context: ReplacePageSchemaToolContext,
): AgentEngineTool {
  return {
    name: 'replace_page_schema',
    description: 'Replace the complete current page Schema after authoritative server validation.',
    parameters,
    execute: async (input, signal) => {
      if (!Value.Check(parameters, input)) throw invalid('replace_page_schema 参数无效');
      assertNotCancelled(signal);
      const run = dependencies.runs.get(context.runId);
      if (!run) throw notFound('Agent Run 不存在');
      if (
        run.projectId !== context.projectId ||
        run.pageId !== context.pageId ||
        run.userMessageId !== context.messageId ||
        run.baseRevisionId !== context.baseRevisionId
      ) {
        throw conflict('Agent Run 无权修改当前页面');
      }
      if (run.status !== 'tool_calling') {
        throw conflict('Agent Run 当前状态不允许写入');
      }
      const project = dependencies.projects.getProject(context.projectId);
      const page = dependencies.projects.getPage(context.projectId, context.pageId);
      if (!project || !page) throw notFound('页面不存在或不属于当前项目');
      const schema = input.schema as OrigamixPageSchema;
      if (Buffer.byteLength(JSON.stringify(schema), 'utf8') > context.maxSchemaBytes) {
        throw new AgentEngineError('BUDGET_EXCEEDED', 'Schema 大小已超过本次运行预算');
      }
      const digest = createHash('sha256').update(JSON.stringify(schema)).digest('hex').slice(0, 16);
      const result = await commitSchema(
        { projectPath: project.path, pageId: page.id, slug: page.slug },
        {
          changeSetId: `change_${context.runId}_${digest}`,
          pageId: page.id,
          baseRevisionId: context.baseRevisionId,
          source: { kind: 'agent', runId: context.runId, messageId: context.messageId },
          operation: 'replaceSchema',
          schema,
          createdAt: run.createdAt,
        },
        { beforeWrite: () => assertNotCancelled(signal) },
      );
      return { revisionId: result.revisionId };
    },
  };
}
