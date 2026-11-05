import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  PAGE_OUTLET_TYPE,
  isLayoutSchema,
  isLayoutDocument,
  type ApplicationLayout,
} from '@origamix/shared';
import { OrigamixPage, RuntimeErrorBoundary, type OrigamixPageProps } from './react';
import { DesignRenderer, type DesignRendererProps } from './design';
import type { MaterialRegistry, RuntimeSchema } from './core/types';
import { MaterialView, renderLayout } from './renderer';
import { parseLayout } from './core/layout';

export interface LayoutNavigation {
  currentPageId: string;
  /** Return false for a page outside the application's declared page set. */
  navigateToPage: (pageId: string) => boolean;
}
const NavigationContext = createContext<LayoutNavigation | null>(null);
/** Layout materials can navigate without receiving a router, engine, credentials or host APIs. */
export const useLayoutNavigation = (): LayoutNavigation | null => useContext(NavigationContext);
const OutletContext = createContext<ReactNode>(null);
const PageOutlet = () => <>{useContext(OutletContext)}</>;
PageOutlet.origamixLayout = { display: 'block' as const };

export interface OrigamixLayoutProps {
  schema: RuntimeSchema;
  materials: MaterialRegistry;
  children: ReactNode;
  navigation?: {
    currentPageId: string;
    pageIds: readonly string[];
    navigateToPage: (pageId: string) => void;
  };
}

/** Layouts are declarative: only the nested page creates an execution engine. */
export const OrigamixLayout = ({
  schema,
  materials,
  children,
  navigation,
}: OrigamixLayoutProps): React.JSX.Element => {
  const registry = useMemo(() => ({ ...materials, [PAGE_OUTLET_TYPE]: PageOutlet }), [materials]);
  const adapter = useMemo<LayoutNavigation | null>(
    () =>
      navigation
        ? {
            currentPageId: navigation.currentPageId,
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
    <NavigationContext.Provider value={adapter}>
      <OutletContext.Provider value={children}>
        {renderLayout(parseLayout(schema), (node, children) => {
          const element = schema.elements[node.id]!;
          return (
            <MaterialView
              key={node.id}
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
}: DesignLayoutRendererProps): React.JSX.Element => {
  const registry = useMemo(() => ({ ...materials, [PAGE_OUTLET_TYPE]: PageOutlet }), [materials]);
  if (!isLayoutSchema(schema)) throw new Error('布局 Schema 无效');
  return (
    <NavigationContext.Provider value={null}>
      <OutletContext.Provider value={outlet}>
        <DesignRenderer schema={schema} materials={registry} renderElement={renderElement} />
      </OutletContext.Provider>
    </NavigationContext.Provider>
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
  <RuntimeErrorBoundary
    resetKey={JSON.stringify([props.pageId, props.resetKey ?? props.schema, props.layout])}
    onOutcome={props.onOutcome}
    renderError={props.renderError}
  >
    <ApplicationPageContent {...props} />
  </RuntimeErrorBoundary>
);
