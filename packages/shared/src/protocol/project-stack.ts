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
  materialSet: { id: 'official-antd', version: '1.0.0' },
  runtime: { id: 'origamix.react', version: '1.0.0' },
  template: { id: 'origamix.react-antd', version: '1.0.0' },
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
  const materialSet = input.materialSet;
  if (!Value.Check(VersionedStackReferenceSchema, materialSet))
    throw new Error('项目物料集配置无效');
  if (
    materialSet.id !== BUILTIN_PROJECT_STACK.materialSet.id ||
    materialSet.version !== BUILTIN_PROJECT_STACK.materialSet.version
  )
    throw new Error(
      `项目物料集 ${materialSet.id}@${materialSet.version} 不受支持；请安装匹配版本，不能自动替换物料集`,
    );
  return {
    ...BUILTIN_PROJECT_STACK,
    materialSet: { ...materialSet },
    runtime: { ...BUILTIN_PROJECT_STACK.runtime },
    template: { ...BUILTIN_PROJECT_STACK.template },
  };
};

export const validateResolvedProjectStack = (value: unknown): ProjectStack => {
  if (!Value.Check(ProjectStackSchema, value)) throw new Error('项目技术栈响应无效');
  const resolved = resolveProjectStack(value);
  if (
    value.runtime.id !== resolved.runtime.id ||
    value.runtime.version !== resolved.runtime.version ||
    value.template.id !== resolved.template.id ||
    value.template.version !== resolved.template.version
  )
    throw new Error('项目运行时或模板版本不受支持');
  return resolved;
};
