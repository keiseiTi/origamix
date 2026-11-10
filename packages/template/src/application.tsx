// Origamix application shell 1.0.0
import { useSyncExternalStore } from 'react';
import { Outlet, useLocation, useNavigate, useHref } from 'react-router';
import {
  ApplicationShell,
  ApplicationProvider,
  ApplicationAccess,
  readApplicationDefinition,
} from '@origamix/runtime';
import layoutMaterials from '@origamix/materials/antd/layout/runtime';
import materials, { RuntimeProvider } from '@origamix/materials/antd/runtime';
import manifest from '../origamix.project.json';
import { projectPages } from './project-pages';
const layoutModules = import.meta.glob<{ default: unknown }>('./origamix-layout/schema.json', {
  eager: true,
});
const subscribeTheme = (notify: () => void) => {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
};
const readTheme = (): 'light' | 'dark' =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';
const readServerTheme = (): 'light' | 'dark' => 'light';
const definition = readApplicationDefinition(manifest);
const Application = (): React.JSX.Element => {
  const location = useLocation(),
    navigate = useNavigate(),
    mode = useSyncExternalStore(subscribeTheme, readTheme, readServerTheme);
  const rootHref = useHref('/').replace(/\/?$/, '/');
  const pages = projectPages.map((page) => ({ ...page, href: `${rootHref}${page.path.slice(1)}` }));
  const currentPageId =
    pages.find((page) => page.path === (location.pathname.replace(/\/+$/, '') || '/'))?.pageId ??
    '';
  const access = definition.access,
    login = access.enabled && currentPageId === access.loginPageId;
  const candidate = new URLSearchParams(location.search).get('returnPageId');
  const returnPageId = pages.some((page) => page.pageId === candidate) ? candidate : null;
  const go = (id: string, returnTo?: string) => {
    const page = pages.find((page) => page.pageId === id);
    if (page)
      void navigate(page.path + (returnTo ? `?returnPageId=${encodeURIComponent(returnTo)}` : ''), {
        replace: Boolean(returnTo),
      });
  };
  const menuPages = pages.filter((page) => !access.enabled || page.pageId !== access.loginPageId);
  return (
    <RuntimeProvider mode={mode}>
      <div className='min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100'>
        <ApplicationProvider
          definition={definition}
          metadata={{ pages, stateKeys: Object.keys(definition.initialState) }}
          navigation={{ navigateToPage: go, returnPageId }}
        >
          <ApplicationAccess
            currentPageId={currentPageId}
            renderPending={() => (
              <p role='status' className='p-8'>
                正在进入页面…
              </p>
            )}
          >
            <ApplicationShell
              projectId={manifest.projectId}
              enabled={manifest.runtime === 'origamix' && manifest.layout.enabled && !login}
              layout={layoutModules['./origamix-layout/schema.json']?.default}
              materials={{ ...layoutMaterials, ...materials }}
              navigation={{
                currentPageId,
                pageIds: menuPages.map((page) => page.pageId),
                pages: menuPages,
                navigateToPage: go,
              }}
            >
              <Outlet />
            </ApplicationShell>
          </ApplicationAccess>
        </ApplicationProvider>
      </div>
    </RuntimeProvider>
  );
};
export default Application;
