import { equalJson, type ProjectSettings } from '@origamix/shared';

export const reconcileProjectSettings = (
  base: ProjectSettings,
  draft: ProjectSettings,
  latest: ProjectSettings,
  keepDraft = true,
) => {
  const conflicts: string[] = [];
  const merge = <T>(label: string, previous: T, edited: T, incoming: T): T => {
    if (equalJson(edited, previous)) return incoming;
    if (equalJson(incoming, previous) || equalJson(incoming, edited)) return edited;
    conflicts.push(label);
    return keepDraft ? edited : incoming;
  };

  return {
    conflicts,
    draft: {
      ...latest,
      shell: {
        title: merge('标题', base.shell.title, draft.shell.title, latest.shell.title),
        logo: merge('Logo', base.shell.logo, draft.shell.logo, latest.shell.logo),
        navigation: merge(
          '菜单',
          base.shell.navigation,
          draft.shell.navigation,
          latest.shell.navigation,
        ),
        homePageId: merge(
          '首页',
          base.shell.homePageId,
          draft.shell.homePageId,
          latest.shell.homePageId,
        ),
        notFoundPageId: merge(
          '404 页面',
          base.shell.notFoundPageId,
          draft.shell.notFoundPageId,
          latest.shell.notFoundPageId,
        ),
        standalonePageIds: merge(
          '独立页面',
          base.shell.standalonePageIds,
          draft.shell.standalonePageIds,
          latest.shell.standalonePageIds,
        ),
      },
      layout: {
        enabled: merge(
          '布局开关',
          base.layout.enabled,
          draft.layout.enabled,
          latest.layout.enabled,
        ),
        initialVariant: merge(
          '布局样式',
          base.layout.initialVariant,
          draft.layout.initialVariant,
          latest.layout.initialVariant,
        ),
      },
      routing: {
        mode: merge('路由模式', base.routing.mode, draft.routing.mode, latest.routing.mode),
        basePath: merge(
          '部署前缀',
          base.routing.basePath,
          draft.routing.basePath,
          latest.routing.basePath,
        ),
      },
    },
  };
};
