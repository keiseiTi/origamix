import { Type, type Static } from '@sinclair/typebox';
import { Check } from '@sinclair/typebox/value';
import { InitialLayoutVariantSchema, ProjectRoutingSchema } from './project-routing.ts';

const pageId = Type.String({ pattern: '^page_[A-Za-z0-9_-]+$' });
const menuId = Type.String({ pattern: '^[A-Za-z0-9_-]{1,80}$' });
export const ProjectMenuItemSchema = Type.Object(
  {
    id: menuId,
    parentId: Type.Optional(menuId),
    title: Type.String({ maxLength: 80 }),
    pageId: Type.Optional(pageId),
    hidden: Type.Boolean(),
  },
  { additionalProperties: false },
);
export const ProjectShellSchema = Type.Object(
  {
    title: Type.String({ maxLength: 80 }),
    logo: Type.String({ maxLength: 2048 }),
    // Missing navigation means not configured; [] is an intentionally empty menu.
    navigation: Type.Optional(Type.Array(ProjectMenuItemSchema, { maxItems: 200 })),
    homePageId: Type.Optional(pageId),
    notFoundPageId: Type.Optional(pageId),
    standalonePageIds: Type.Array(pageId, { uniqueItems: true }),
  },
  { additionalProperties: false },
);
export type ProjectShell = Static<typeof ProjectShellSchema>;
export type ProjectMenuItem = Static<typeof ProjectMenuItemSchema>;
export const defaultProjectShell = (): ProjectShell => ({
  title: '',
  logo: '',
  standalonePageIds: [],
});
export const isProjectLogo = (value: string): boolean =>
  value === '' || /^(?:https?:\/\/[^/\s\\?#@]+(?:[/?#][^\s\\]*)?|\/(?!\/)[^\s\\]*)$/i.test(value);
export const readProjectShell = (manifest: {
  shell: unknown;
  pages: readonly { pageId: string }[];
}): ProjectShell => {
  if (!Check(ProjectShellSchema, manifest.shell)) throw new Error('项目外观配置无效');
  const issue = projectShellIssue(manifest.shell, manifest.pages);
  if (issue) throw new Error(issue);
  return manifest.shell;
};
export const projectShellIssue = (
  shell: ProjectShell,
  pages: readonly { pageId: string }[],
): string | null => {
  if (!Check(ProjectShellSchema, shell)) return '项目外观配置无效';
  if (!isProjectLogo(shell.logo)) return 'Logo 请使用 HTTP(S) 地址或以 / 开头的项目资源路径';
  const pageIds = new Set(pages.map((page) => page.pageId));
  if (
    [
      shell.homePageId,
      shell.notFoundPageId,
      ...shell.standalonePageIds,
      ...(shell.navigation ?? []).map((item) => item.pageId),
    ].some((id) => id !== undefined && !pageIds.has(id))
  )
    return '配置引用的页面不存在';
  const items = shell.navigation ?? [],
    ids = new Set(items.map((item) => item.id));
  if (ids.size !== items.length) return '菜单标识不能重复';
  for (const item of items) {
    if (!item.pageId && !item.title.trim()) return '菜单分组需要填写标题';
    const visited = new Set([item.id]);
    let parent = item.parentId;
    while (parent) {
      if (!ids.has(parent) || visited.has(parent)) return '菜单父级不存在或存在循环';
      visited.add(parent);
      parent = items.find((candidate) => candidate.id === parent)?.parentId;
    }
  }
  return null;
};
export const ProjectSettingsUpdateSchema = Type.Object(
  {
    projectId: Type.String({ pattern: '^project_[A-Za-z0-9_-]+$' }),
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
    expectedManifestHash: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    shell: ProjectShellSchema,
    layout: Type.Object(
      { enabled: Type.Boolean(), initialVariant: InitialLayoutVariantSchema },
      { additionalProperties: false },
    ),
    routing: ProjectRoutingSchema,
  },
  { additionalProperties: false },
);
export type ProjectSettingsUpdate = Static<typeof ProjectSettingsUpdateSchema>;
export interface ProjectSettings extends Omit<ProjectSettingsUpdate, 'expectedManifestHash'> {
  name: string;
  pages: { pageId: string; name: string; slug: string }[];
  manifestHash: string;
}
