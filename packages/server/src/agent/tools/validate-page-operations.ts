import { createAgentElementIds, type AgentElementIds } from './element-ids';
import { SchemaOperationSchema, type SchemaOperation } from '@origamix/shared';
import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { AgentEngineError, type AgentEngineTool } from '../agent-engine';
import type { AgentProjects, AgentSchemaPage } from '../persistence';
import { invalid, notFound } from '../../errors';
import { validateWorkingSchemaOperations } from '../../schema/schema-service';
import { SchemaValidationError } from '../../schema/validation/schema-validation';
import type { CompletePageRunToolScope } from './complete-page-run';

const parameters = Type.Object(
  {
    operations: Type.Array(SchemaOperationSchema, { minItems: 1, maxItems: 200 }),
  },
  { additionalProperties: false },
);

export const createValidatePageOperationsTool = (
  projects: AgentProjects,
  scope: CompletePageRunToolScope,
  elementIds: AgentElementIds = createAgentElementIds(),
  resolvePage?: AgentSchemaPage,
): AgentEngineTool => ({
  name: 'validate_page_operations',
  description:
    '可选预检：提交本次完整 operations，服务端在 Run 起始 Working 版本上使用与最终提交相同的校验，不写入、不保存版本。不需要生成整份 Schema；通过后仍须 complete_page_run。信息齐全时可直接终态提交，避免重复预检。',
  parameters,
  execute: async (raw, signal) => {
    if (signal.aborted) throw signal.reason;
    if (!Value.Check(parameters, raw)) throw invalid('Operation List 参数无效');
    const { operations } = raw as { operations: SchemaOperation[] };
    if (
      Buffer.byteLength(JSON.stringify(operations)) >
      (scope.maxOperationBytes ?? scope.maxSchemaBytes)
    )
      throw new AgentEngineError('BUDGET_EXCEEDED', 'Operation List 大小已超过本次运行预算');
    const project = await projects.getProject(scope.projectId);
    const page = scope.pageId ? await projects.getPage(scope.projectId, scope.pageId) : undefined;
    if (!project || project.status !== 0 || !page || page.status !== 0)
      throw notFound('页面不存在或不属于当前项目');
    try {
      elementIds.validate(operations);
      await validateWorkingSchemaOperations(
        resolvePage?.(scope.projectId, page.id) ?? {
          projectPath: project.path,
          pageId: page.id,
          slug: page.slug,
          relativePath: page.relativePath,
        },
        { baseWorkingVersion: scope.baseWorkingVersion, operations },
        (candidate) => {
          if (signal.aborted) throw signal.reason;
          if (Buffer.byteLength(JSON.stringify(candidate)) > scope.maxSchemaBytes)
            throw new AgentEngineError('BUDGET_EXCEEDED', '最终 Schema 大小超过本次运行预算');
        },
      );
      return { valid: true, workingVersion: scope.baseWorkingVersion };
    } catch (error) {
      if (!(error instanceof SchemaValidationError)) throw error;
      return { valid: false, workingVersion: scope.baseWorkingVersion, errors: [error.issue] };
    }
  },
});
