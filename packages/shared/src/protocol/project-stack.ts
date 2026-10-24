import { ORIGAMIX_VERSION, isSupportedOrigamixVersion } from '../version.ts';
import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

export const VersionedStackReferenceSchema = Type.Object(
  {
    id: Type.String({ minLength: 1, maxLength: 100 }),
    version: Type.String({ minLength: 1, maxLength: 40 }),
  },
  { additionalProperties: false },
);

export const ProjectStackSchema = Type.Object(
  {
    framework: Type.String({ minLength: 1 }),
    uiLibrary: Type.String({ minLength: 1 }),
    materialSet: VersionedStackReferenceSchema,
    runtime: VersionedStackReferenceSchema,
    template: VersionedStackReferenceSchema,
  },
  { additionalProperties: false },
);
export type ProjectStack = Static<typeof ProjectStackSchema>;

// Supported built-in stack identity, not a material catalog or a package loader.
export const BUILTIN_PROJECT_STACK = {
  framework: 'react',
  uiLibrary: 'antd',
  materialSet: { id: 'official-antd', version: ORIGAMIX_VERSION },
  runtime: { id: 'origamix.react', version: ORIGAMIX_VERSION },
  template: { id: 'origamix.react-antd', version: ORIGAMIX_VERSION },
} as const satisfies ProjectStack;

export const resolveProjectStack = (descriptor: unknown): ProjectStack => {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor))
    throw new Error('项目技术栈配置无效');
  const input = descriptor as Record<string, unknown>;
  if (
    input.framework !== BUILTIN_PROJECT_STACK.framework ||
    input.uiLibrary !== BUILTIN_PROJECT_STACK.uiLibrary
  )
    throw new Error('项目技术栈不受支持，当前仅支持 React + Antd');
  if (input.materialSet !== BUILTIN_PROJECT_STACK.materialSet.id)
    throw new Error('项目物料集配置无效');
  if (!isSupportedOrigamixVersion(input.version))
    throw new Error(`项目版本 ${String(input.version)} 不受支持`);
  // Editing always uses the installed release. The manifest keeps the target runtime version.
  return structuredClone(BUILTIN_PROJECT_STACK);
};

export const validateResolvedProjectStack = (value: unknown): ProjectStack => {
  if (!Value.Check(ProjectStackSchema, value)) throw new Error('项目技术栈响应无效');
  const resolved = resolveProjectStack({
    ...value,
    version: value.materialSet.version,
    materialSet: value.materialSet.id,
  });
  if (
    value.materialSet.version !== resolved.materialSet.version ||
    value.runtime.id !== resolved.runtime.id ||
    value.runtime.version !== resolved.runtime.version ||
    value.template.id !== resolved.template.id ||
    value.template.version !== resolved.template.version
  )
    throw new Error('项目运行时或模板版本不受支持');
  return resolved;
};
