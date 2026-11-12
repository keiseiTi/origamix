import type { ProjectManifest } from './project-manifest.ts';

/** The one page/path mapping used by generated applications. */
export const applicationPages = (manifest: Pick<ProjectManifest, 'pages' | 'shell'>) => {
  const home = manifest.shell.homePageId;
  return manifest.pages.map((page) => ({
    ...page,
    path: (home ? page.pageId === home : page.slug === 'home') ? '/' : `/${page.slug}`,
  }));
};
