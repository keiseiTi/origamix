import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { PageNavigationMetadata } from '@origamix/shared';
import type { RuntimeEngine } from './core/types';
interface PageNavigation {
  navigate: (pageId: string) => void;
}
const Context = createContext<PageNavigation | null>(null);
const engines = new WeakMap<RuntimeEngine, PageNavigation>();
export const PageNavigationProvider = ({
  pages,
  onNavigate,
  children,
}: PageNavigationMetadata & {
  onNavigate: (pageId: string) => void;
  children: ReactNode;
}) => {
  const navigation = useMemo<PageNavigation>(
    () => ({
      navigate: (pageId) => {
        if (!pages.some((page) => page.pageId === pageId))
          throw new Error('目标页面不属于当前项目');
        onNavigate(pageId);
      },
    }),
    [pages, onNavigate],
  );
  return <Context.Provider value={navigation}>{children}</Context.Provider>;
};
export const usePageNavigation = () => useContext(Context);
export const bindPageNavigation = (engine: RuntimeEngine, navigation: PageNavigation | null) => {
  if (navigation) engines.set(engine, navigation);
  else engines.delete(engine);
};
export const navigateEnginePage = (engine: RuntimeEngine, pageId: string) => {
  const navigation = engines.get(engine);
  if (!navigation) throw new Error('页面跳转需要项目路由上下文，请在生成项目中运行');
  navigation.navigate(pageId);
};
