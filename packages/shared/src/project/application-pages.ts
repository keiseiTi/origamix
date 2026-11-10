import type { ProjectManifest } from './project-manifest.ts';

/** The one page/path mapping used by generated applications and built-in project preview. */
export const applicationPages = (
  manifest: Pick<ProjectManifest, 'pages' | 'pageRoles' | 'access'>,
) => {
  const home = manifest.access?.enabled
    ? manifest.access.homePageId
    : manifest.pageRoles?.assignments.home;
  return manifest.pages.map((page) => ({
    ...page,
    path: (home ? page.pageId === home : page.slug === 'home') ? '/' : `/${page.slug}`,
  }));
};
