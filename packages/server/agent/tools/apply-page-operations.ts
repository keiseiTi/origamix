import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { SchemaOperationSchema, type SchemaOperation } from '@origamix/shared/protocol/schema';
import type { AgentRunRepository } from '../run-repository';
import type { ProjectRepository } from '../../projects/project-repository';
import { conflict, invalid, notFound } from '../../errors';
import { applyWorkingSchemaOperations } from '../../schema/schema-service';
import { AgentEngineError, type AgentEngineTool } from '../engine';

export interface ApplyPageOperationsToolContext {
  runId: string;
  messageId: string;
  projectId: string;
  pageId: string;
  baseWorkingVersion: number;
  maxSchemaBytes: number;
}

export interface ApplyPageOperationsToolDependencies {
  projects: Pick<ProjectRepository, 'getProject' | 'getPage'>;
  runs: Pick<AgentRunRepository, 'get'>;
}

const parameters = Type.Object(
  { operations: Type.Array(SchemaOperationSchema, { minItems: 1, maxItems: 100 }) },
  { additionalProperties: false },
);

const assertNotCancelled = (signal: AbortSignal): void => {
  if (signal.aborted) throw new AgentEngineError('CANCELLED', '页面修改已取消');
};

export const createApplyPageOperationsTool = (
  dependencies: ApplyPageOperationsToolDependencies,
  context: ApplyPageOperationsToolContext,
): AgentEngineTool => {
  return {
    name: 'apply_page_operations',
    description:
      'Atomically apply a typed list of operations to the current page Working Schema after server validation.',
    parameters,
    execute: async (input, signal) => {
      if (!Value.Check(parameters, input)) throw invalid('apply_page_operations 参数无效');
      assertNotCancelled(signal);
      const run = dependencies.runs.get(context.runId);
      if (!run) throw notFound('Agent Run 不存在');
      if (
        run.projectId !== context.projectId ||
        run.pageId !== context.pageId ||
        run.userMessageId !== context.messageId ||
        run.baseWorkingVersion !== context.baseWorkingVersion
      ) {
        throw conflict('Agent Run 无权修改当前页面');
      }
      if (run.status !== 'tool_calling') {
        throw conflict('Agent Run 当前状态不允许写入');
      }
      const project = dependencies.projects.getProject(context.projectId);
      const page = dependencies.projects.getPage(context.projectId, context.pageId);
      if (!project || !page) throw notFound('页面不存在或不属于当前项目');
      const operations = input.operations as SchemaOperation[];
      if (Buffer.byteLength(JSON.stringify(operations), 'utf8') > context.maxSchemaBytes) {
        throw new AgentEngineError('BUDGET_EXCEEDED', 'Operation List 大小已超过本次运行预算');
      }
      const result = await applyWorkingSchemaOperations(
        {
          projectPath: project.path,
          pageId: page.id,
          slug: page.slug,
          relativePath: page.relativePath,
        },
        { baseWorkingVersion: context.baseWorkingVersion, operations },
        { beforeWrite: () => assertNotCancelled(signal) },
      );
      return { workingVersion: result.workingVersion };
    },
  };
};
