import { Type, type Static } from '@sinclair/typebox';
import { Check } from '@sinclair/typebox/value';
const id = Type.String({ pattern: '^page_[A-Za-z0-9_-]+$' });
export const ApplicationStateNameSchema = Type.String({
  pattern: '^(?!__proto__$|prototype$|constructor$)[A-Za-z][A-Za-z0-9_]*$',
});
export const ApplicationStateSchema = Type.Record(ApplicationStateNameSchema, Type.Unknown(), {
  additionalProperties: false,
});
export const ProjectAccessSchema = Type.Union([
  Type.Object({ enabled: Type.Literal(false) }, { additionalProperties: false }),
  Type.Object(
    {
      enabled: Type.Literal(true),
      loginPageId: id,
      homePageId: id,
      publicPageIds: Type.Array(id, { uniqueItems: true }),
      stateKey: ApplicationStateNameSchema,
    },
    { additionalProperties: false },
  ),
]);
export type ProjectAccess = Static<typeof ProjectAccessSchema>;
export type ApplicationState = Record<string, unknown>;
export interface ApplicationDefinition {
  initialState: ApplicationState;
  access: ProjectAccess;
}
export interface ApplicationMetadata {
  pages: readonly { pageId: string; name: string; path?: string }[];
  stateKeys: readonly string[];
  access?: Extract<ProjectAccess, { enabled: true }>;
}
export const ProjectApplicationUpdateSchema = Type.Object(
  {
    projectId: Type.String({ pattern: '^project_[A-Za-z0-9_-]+$' }),
    expectedManifestHash: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    initialState: ApplicationStateSchema,
    access: ProjectAccessSchema,
  },
  { additionalProperties: false },
);
export type ProjectApplicationUpdate = Static<typeof ProjectApplicationUpdateSchema>;
export interface ProjectApplicationSettings extends ApplicationDefinition {
  runtime: 'origamix' | 'external';
  pages: { pageId: string; name: string }[];
  manifestHash: string;
}
const jsonValue = (value: unknown): boolean =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value)) ||
  (Array.isArray(value) && value.every(jsonValue)) ||
  (Boolean(value) &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.entries(value).every(
      ([key, item]) => !['__proto__', 'prototype', 'constructor'].includes(key) && jsonValue(item),
    ));
export const applicationIssue = (
  definition: ApplicationDefinition,
  pages: readonly { pageId: string }[],
  runtime: string,
): string | null => {
  if (!jsonValue(definition.initialState))
    return '应用初始状态必须是 JSON 数据，且不能包含保留字段';
  if (
    !Check(ApplicationStateSchema, definition.initialState) ||
    !Check(ProjectAccessSchema, definition.access)
  )
    return '应用状态或访问规则无效';
  if (
    runtime !== 'origamix' &&
    (definition.access.enabled || Object.keys(definition.initialState).length)
  )
    return '外部工程不支持平台应用配置';
  const access = definition.access;
  if (!access.enabled) return null;
  const ids = new Set(pages.map((page) => page.pageId));
  if ([access.loginPageId, access.homePageId, ...access.publicPageIds].some((id) => !ids.has(id)))
    return '访问规则引用的页面不存在';
  if (access.loginPageId === access.homePageId) return '登录页不能作为默认首页';
  if (typeof definition.initialState[access.stateKey] !== 'boolean')
    return '访问状态字段必须在应用初始状态中声明为布尔值';
  return null;
};
export const readApplicationDefinition = (manifest: {
  runtime: string;
  pages: readonly { pageId: string }[];
  applicationState?: unknown;
  access?: unknown;
}): ApplicationDefinition => {
  const value = {
    initialState: manifest.applicationState ?? {},
    access: manifest.access ?? { enabled: false },
  } as ApplicationDefinition;
  const issue = applicationIssue(value, manifest.pages, manifest.runtime);
  if (issue) throw new Error(issue);
  return value;
};
