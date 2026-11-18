// Origamix application shell 1.0.0
import { useSyncExternalStore, useMemo, useCallback } from 'react';
import { Outlet, useMatches, useNavigate, useHref } from 'react-router';
import { readProjectShell, PageNavigationProvider } from '@origamix/runtime';
import { RuntimeProvider } from '@origamix/materials/antd/runtime';
import manifest from '../origamix.project.json';
import { readLayoutVariant } from './routing-config';
import { projectPages } from './project-pages';
import { ApplicationShell } from './application-shell';
const subscribeTheme = (notify: () => void) => {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
};
const readTheme = (): 'light' | 'dark' =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';
const readServerTheme = (): 'light' | 'dark' => 'light';
const shell = readProjectShell(manifest);
const Application = (): React.JSX.Element => {
  const matches = useMatches(),
    navigate = useNavigate(),
    mode = useSyncExternalStore(subscribeTheme, readTheme, readServerTheme);
  const rootHref = useHref('/').replace(/\/?$/, '/');
  const pages = useMemo(
    () => projectPages.map((page) => ({ ...page, href: `${rootHref}${page.path.slice(1)}` })),
    [rootHref],
  );
  const matchedPageId = matches.at(-1)?.handle;
  const currentPageId = typeof matchedPageId === 'string' ? matchedPageId : '';
  const go = useCallback(
    (id: string) => {
      const page = pages.find((page) => page.pageId === id);
      if (page) void navigate(page.path);
    },
    [pages, navigate],
  );
  return (
    <RuntimeProvider mode={mode}>
      <div className='min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100'>
        <PageNavigationProvider pages={pages} onNavigate={go}>
          <ApplicationShell
            config={{
              ...shell,
              logo: shell.logo.startsWith('/')
                ? manifest.routing.basePath + shell.logo.slice(1)
                : shell.logo,
            }}
            title={manifest.name}
            enabled={manifest.layout.enabled && !shell.standalonePageIds.includes(currentPageId)}
            variant={readLayoutVariant(manifest)}
            pages={pages}
            currentPageId={currentPageId}
            onNavigate={go}
          >
            <Outlet />
          </ApplicationShell>
        </PageNavigationProvider>
      </div>
    </RuntimeProvider>
  );
};
export default Application;
