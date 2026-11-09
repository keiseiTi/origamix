import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import {
  MATERIAL_CONTRACT_VERSION,
  SEMVER_PATTERN,
  SUPPORTED_MATERIAL_VERSIONS,
  contractCompatibilityIssue,
} from '../version.ts';

export const VersionedStackReferenceSchema = Type.Object(
  {
    id: Type.String({ minLength: 1, maxLength: 100 }),
    version: Type.String({ pattern: SEMVER_PATTERN, maxLength: 100 }),
  },
  { additionalProperties: false },
);
export const ProjectStackSchema = Type.Object(
  {
    framework: Type.String({ minLength: 1 }),
    materialSet: VersionedStackReferenceSchema,
  },
  { additionalProperties: false },
);
export type ProjectStack = Static<typeof ProjectStackSchema>;
export const BUILTIN_PROJECT_STACK = {
  framework: 'react',
  materialSet: { id: 'official-antd', version: MATERIAL_CONTRACT_VERSION },
} as const satisfies ProjectStack;

/** Read the declared current-format stack; support validation is a separate rejection boundary. */
export const resolveProjectStack = (descriptor: unknown): ProjectStack => {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor))
    throw new Error('项目技术栈配置无效');
  const { framework, materialSet } = descriptor as Record<string, unknown>;
  const stack = { framework, materialSet };
  if (!Value.Check(ProjectStackSchema, stack)) throw new Error('项目技术栈配置无效');
  return structuredClone(stack);
};
export const projectStackCompatibilityIssue = (stack: ProjectStack): string | null => {
  if (stack.framework !== BUILTIN_PROJECT_STACK.framework)
    return `当前应用不支持框架 ${stack.framework}`;
  if (stack.materialSet.id !== BUILTIN_PROJECT_STACK.materialSet.id)
    return `当前应用不支持物料集 ${stack.materialSet.id}`;
  return contractCompatibilityIssue(
    '物料契约',
    stack.materialSet.version,
    SUPPORTED_MATERIAL_VERSIONS,
  );
};
export const validateResolvedProjectStack = (value: unknown): ProjectStack => {
  if (!Value.Check(ProjectStackSchema, value)) throw new Error('项目技术栈响应无效');
  const issue = projectStackCompatibilityIssue(value);
  if (issue) throw new Error(issue);
  return structuredClone(value);
};
