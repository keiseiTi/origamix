import { createContext, useContext, useMemo, type ReactNode, type MouseEvent } from 'react';
import {
  PAGE_OUTLET_TYPE,
  PAGE_NAVIGATION_TYPE,
  isLayoutSchema,
  isLayoutDocument,
  type ApplicationLayout,
} from '@origamix/shared';
import { OrigamixPage, RuntimeErrorBoundary, type OrigamixPageProps } from './react';
import { DesignRenderer, type DesignRendererProps } from './design';
import type { MaterialRegistry, RuntimeSchema } from './core/types';
import { MaterialView, renderLayout } from './renderer';
import { parseLayout } from './core/layout';
import {
  DiagnosticsProvider,
  DiagnosticScopeContext,
  type RuntimeDiagnosticsProps,
} from './diagnostics';

export interface LayoutNavigation {
  currentPageId: string;
  /** Return false for a page outside the application's declared page set. */
  navigateToPage: (pageId: string) => boolean;
  pages: readonly { pageId: string; name: string; path: string; href?: string }[];
}
const NavigationContext = createContext<LayoutNavigation | null>(null);
/** Layout materials can navigate without receiving a router, engine, credentials or host APIs. */
export const useLayoutNavigation = (): LayoutNavigation | null => useContext(NavigationContext);
const OutletContext = createContext<ReactNode>(null);
const PageOutlet = () => (
  <DiagnosticScopeContext.Provider value='page'>
    {useContext(OutletContext)}
  </DiagnosticScopeContext.Provider>
);
PageOutlet.origamixLayout = { display: 'block' as const };

const PageNavigation = (props: Record<string, unknown>): React.JSX.Element => {
  const navigation = useLayoutNavigation();
  const horizontal = props.direction === 'horizontal';
  return (
    <nav
      aria-label='页面导航'
      className={horizontal ? 'flex flex-wrap gap-2' : 'flex flex-col gap-2'}
    >
      {navigation?.pages.length ? (
        navigation.pages.map((page) => (
          <a
            key={page.pageId}
            href={page.href ?? page.path}
            aria-current={navigation.currentPageId === page.pageId ? 'page' : undefined}
            className='rounded px-3 py-2 text-inherit hover:underline focus-visible:outline-2 aria-[current=page]:font-semibold aria-[current=page]:underline'
            onClick={(event: MouseEvent<HTMLAnchorElement>) => {
              if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              if (navigation.navigateToPage(page.pageId)) event.preventDefault();
            }}
          >
            {page.name}
          </a>
        ))
      ) : (
        <span>页面导航</span>
      )}
    </nav>
  );
};
PageNavigation.origamixLayout = { display: 'block' as const };

/** Enabled state comes only from the project manifest; runtime never reads local editor data. */
export const resolveApplicationLayout = (
  projectId: string,
  enabled: boolean,
  document: unknown,
): ApplicationLayout => {
  if (!enabled) return { enabled: false };
  if (!isLayoutDocument(document) || document.projectId !== projectId)
    throw new Error('项目已开启布局，请先在 Origamix 中保存版本并应用布局配置。');
  return { enabled: true, document };
};

export interface OrigamixLayoutProps extends RuntimeDiagnosticsProps {
  schema: RuntimeSchema;
  materials: MaterialRegistry;
  children: ReactNode;
  navigation?: {
    currentPageId: string;
    pageIds: readonly string[];
    pages?: readonly { pageId: string; name: string; path: string; href?: string }[];
    navigateToPage: (pageId: string) => void;
  };
}

/** Layouts are declarative: only the nested page creates an execution engine. */
export const OrigamixLayout = ({
  schema,
  materials,
  children,
  navigation,
  ...diagnostics
}: OrigamixLayoutProps): React.JSX.Element => {
  const registry = useMemo(
    () => ({
      ...materials,
      [PAGE_OUTLET_TYPE]: PageOutlet,
      [PAGE_NAVIGATION_TYPE]: PageNavigation,
    }),
    [materials],
  );
  const adapter = useMemo<LayoutNavigation | null>(
    () =>
      navigation
        ? {
            currentPageId: navigation.currentPageId,
            pages: (navigation.pages ?? []).filter(
              (page) =>
                navigation.pageIds.includes(page.pageId) &&
                /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/.test(page.path) &&
                (page.href === undefined ||
                  /^(?:#\/|\/)(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]*$/.test(page.href)),
            ),
            navigateToPage: (pageId) => {
              if (!navigation.pageIds.includes(pageId)) return false;
              navigation.navigateToPage(pageId);
              return true;
            },
          }
        : null,
    [navigation],
  );
  if (!isLayoutSchema(schema))
    throw new Error('布局 Schema 无效：需要唯一页面内容区，且不支持业务流程');
  return (
    <DiagnosticsProvider {...diagnostics}>
      <DiagnosticScopeContext.Provider value='layout'>
        <NavigationContext.Provider value={adapter}>
          <OutletContext.Provider value={children}>
            {renderLayout(parseLayout(schema), (node, children) => {
              const element = schema.elements[node.id]!;
              return (
                <MaterialView
                  key={node.id}
                  resetToken={element.props}
                  id={node.id}
                  root={node.id === schema.layout.root}
                  type={element.type}
                  components={registry}
                  props={{ ...element.props, om_mode: 'render' }}
                >
                  {children}
                </MaterialView>
              );
            })}
          </OutletContext.Provider>
        </NavigationContext.Provider>
      </DiagnosticScopeContext.Provider>
    </DiagnosticsProvider>
  );
};

export interface DesignLayoutRendererProps extends Omit<DesignRendererProps, 'materials'> {
  materials: MaterialRegistry;
  outlet?: ReactNode;
}
/** Design-only outlet contents stay read-only; host selection commands remain layout-scoped. */
export const DesignLayoutRenderer = ({
  schema,
  materials,
  renderElement,
  outlet,
  ...diagnostics
}: DesignLayoutRendererProps): React.JSX.Element => {
  const registry = useMemo(
    () => ({
      ...materials,
      [PAGE_OUTLET_TYPE]: PageOutlet,
      [PAGE_NAVIGATION_TYPE]: PageNavigation,
    }),
    [materials],
  );
  if (!isLayoutSchema(schema)) throw new Error('布局 Schema 无效');
  return (
    <DiagnosticScopeContext.Provider value='layout'>
      <NavigationContext.Provider value={null}>
        <OutletContext.Provider value={outlet}>
          <DesignRenderer
            {...diagnostics}
            schema={schema}
            materials={registry}
            renderElement={renderElement}
          />
        </OutletContext.Provider>
      </NavigationContext.Provider>
    </DiagnosticScopeContext.Provider>
  );
};

export interface OrigamixApplicationPageProps extends OrigamixPageProps {
  pageId: string;
  layout: ApplicationLayout;
  navigation?: OrigamixLayoutProps['navigation'];
}
/** Applies the sole project layout to every page without merging schemas or execution sessions. */
const ApplicationPageContent = ({
  pageId,
  layout,
  navigation,
  ...page
}: OrigamixApplicationPageProps): React.JSX.Element => {
  const content = <OrigamixPage key={pageId} {...page} />;
  if (!layout.enabled) return content;
  if (!isLayoutDocument(layout.document)) throw new Error('布局文档结构或版本不受支持');
  return (
    <OrigamixLayout
      schema={layout.document.schema}
      materials={page.materials}
      navigation={navigation}
    >
      {content}
    </OrigamixLayout>
  );
};

export const OrigamixApplicationPage = (props: OrigamixApplicationPageProps): React.JSX.Element => (
  <DiagnosticsProvider
    onOutcome={props.onOutcome}
    onDiagnosticsChange={props.onDiagnosticsChange}
    onRenderError={props.onRenderError}
    renderElementError={props.renderElementError}
  >
    <RuntimeErrorBoundary
      resetKey={JSON.stringify([props.pageId, props.resetKey ?? props.schema, props.layout])}
      renderError={props.renderError}
    >
      <ApplicationPageContent {...props} />
    </RuntimeErrorBoundary>
  </DiagnosticsProvider>
);
