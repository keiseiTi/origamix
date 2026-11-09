import manifest from '../origamix.project.json';

/** One mapping drives routes, navigation and current-page matching. */
export const projectPages = manifest.pages.map(
  (page: { pageId: string; name: string; slug: string }) => ({
    ...page,
    path: page.slug === 'home' ? '/' : `/${page.slug}`,
  }),
);
