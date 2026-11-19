import {
  equalJson,
  isProjectLayoutEnabled,
  projectShellIssue,
  type ProjectManifest,
  type ProjectNavigationInfo,
  type ProjectRouting,
  type ProjectSettings,
  type ProjectSettingsUpdate,
} from '@origamix/shared';
import { conflict, invalid } from '../errors';

export const requireProjectName = (name: string): string => {
  if (!name || /[\\/:*?"<>|]/.test(name)) throw invalid('项目名称无效');
  return name;
};

export const projectSettings = (
  manifest: ProjectManifest,
  manifestHash: string,
): ProjectSettings => ({
  projectId: manifest.projectId,
  name: manifest.name,
  pages: manifest.pages,
  shell: manifest.shell,
  layout: manifest.layout,
  routing: manifest.routing,
  manifestHash,
});

export const projectNavigation = (manifest: ProjectManifest): ProjectNavigationInfo => ({
  runtime: manifest.runtime,
  layoutEnabled: isProjectLayoutEnabled(manifest),
  pages: manifest.pages.map(({ pageId, name }) => ({ pageId, name })),
});

const sameProjectRouting = (left: ProjectRouting, right: ProjectRouting): boolean =>
  left.mode === right.mode && left.basePath === right.basePath;

export const prepareProjectSettings = (manifest: ProjectManifest, input: ProjectSettingsUpdate) => {
  const name = requireProjectName(input.name?.trim() ?? manifest.name);
  const issue = projectShellIssue(input.shell, manifest.pages);
  if (issue) throw invalid(issue);
  const changed =
    manifest.name !== name ||
    !equalJson(manifest.shell, input.shell) ||
    !equalJson(manifest.layout, input.layout) ||
    !sameProjectRouting(manifest.routing, input.routing);
  return {
    changed,
    manifest: {
      ...manifest,
      name,
      shell: input.shell,
      layout: input.layout,
      routing: input.routing,
    },
  };
};

export const pagesWithout = (
  manifest: ProjectManifest,
  pageId: string,
  conflictMessage: string,
) => {
  const pages = manifest.pages.filter((page) => page.pageId !== pageId);
  if (projectShellIssue(manifest.shell, pages)) throw conflict(conflictMessage);
  return pages;
};
