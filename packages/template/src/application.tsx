// Origamix application shell 1.0.0
import { useSyncExternalStore } from 'react';
import { Outlet, useLocation, useNavigate, useHref } from 'react-router';
import { OrigamixLayout, resolveApplicationLayout } from '@origamix/runtime';
import layoutMaterials from '@origamix/materials/antd/layout/runtime';
import materials, { RuntimeProvider } from '@origamix/materials/antd/runtime';
import manifest from '../origamix.project.json';
import { projectPages } from './project-pages';

const layoutModules = import.meta.glob<{ default: unknown }>('./origamix-layout/schema.json', {
  eager: true,
});
const subscribeTheme = (notify: () => void): (() => void) => {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
};
const readTheme = (): 'light' | 'dark' =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';
const readServerTheme = (): 'light' | 'dark' => 'light';

const Application = (): React.JSX.Element => {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = useSyncExternalStore(subscribeTheme, readTheme, readServerTheme);
  const rootHref = useHref('/').replace(/\/?$/, '/');
  const pages = projectPages.map((page) => ({ ...page, href: `${rootHref}${page.path.slice(1)}` }));
  const currentPageId =
    pages.find((page) => page.path === (location.pathname.replace(/\/+$/, '') || '/'))?.pageId ??
    '';
  const layout = resolveApplicationLayout(
    manifest.projectId,
    manifest.layout.enabled,
    layoutModules['./origamix-layout/schema.json']?.default,
  );
  const content = <Outlet />;
  return (
    <RuntimeProvider mode={mode}>
      <div className='min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100'>
        {layout.enabled ? (
          <OrigamixLayout
            schema={layout.document.schema}
            materials={{ ...materials, ...layoutMaterials }}
            navigation={{
              currentPageId,
              pageIds: pages.map((page) => page.pageId),
              pages,
              navigateToPage: (pageId) => {
                const page = pages.find((page) => page.pageId === pageId);
                if (page) void navigate(page.path);
              },
            }}
          >
            {content}
          </OrigamixLayout>
        ) : (
          content
        )}
      </div>
    </RuntimeProvider>
  );
};
export default Application;
