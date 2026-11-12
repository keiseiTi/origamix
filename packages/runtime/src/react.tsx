import { bindPageNavigation, usePageNavigation } from './page-navigation';
import {
  installMaterialState,
  bindMaterialEventPayloads,
  captureRuntimeEvent,
} from './material-state';
import {
  Component,
  useMemo,
  useState,
  useRef,
  useLayoutEffect,
  useSyncExternalStore,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { createLogicNodes } from './logic-nodes';
import { createEngine, ELEMENT_UPDATE, VIEW_UPDATE } from './core/engine';
import { withFlowEngine } from './core/flow';
import type { RuntimeSchema as Schema, MaterialRegistry } from './core/types';
import { MaterialView, renderLayout } from './renderer';
import {
  DiagnosticsContext,
  DiagnosticsProvider,
  useRuntimeDiagnostic,
  type RuntimeDiagnosticsProps,
  type RuntimeDiagnostic,
} from './diagnostics';
export type { RuntimeDiagnostic, RuntimeOutcome } from './diagnostics';

export const findUnknownMaterialTypes = (schema: Schema, materials: MaterialRegistry): string[] => {
  return [...new Set(Object.values(schema.elements).map((element) => element.type))].filter(
    (type) => !(type in materials),
  );
};

interface ErrorBoundaryProps {
  children: ReactNode;
  renderError?: (error: Error, retry: () => void) => ReactNode;
}

export class RuntimeErrorBoundary extends Component<ErrorBoundaryProps, { error: Error | null }> {
  static contextType = DiagnosticsContext;
  declare context: React.ContextType<typeof DiagnosticsContext>;
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Origamix page render failed', error, info.componentStack);
    this.context?.set(this, { code: 'RENDER_ERROR', stage: 'render', safeMessage: '页面渲染失败' });
  }

  componentWillUnmount(): void {
    this.context?.set(this, null);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    const retry = (): void => {
      this.context?.set(this, null);
      this.setState({ error: null });
    };
    return (
      this.props.renderError?.(this.state.error, retry) ?? (
        <main role='alert'>页面渲染失败：{this.state.error.message}</main>
      )
    );
  }
}

type RuntimeComponents = MaterialRegistry;
type Engine = ReturnType<typeof createEngine>;

/** Subscribe per element so another element's event never remounts a focused input. */
const RuntimeElement = ({
  id,
  engine,
  components,
  children,
}: {
  id: string;
  engine: Engine;
  components: RuntimeComponents;
  children?: ReactNode;
  tabKey?: unknown;
}): React.JSX.Element | null => {
  const element = useSyncExternalStore(
    (notify) => {
      const unsubscribe = engine.subscribe(ELEMENT_UPDATE, notify);
      const unsubscribeView = engine.subscribe(VIEW_UPDATE, notify);
      return () => {
        unsubscribe();
        unsubscribeView();
      };
    },
    () => engine.elements[id],
    () => engine.elements[id],
  );

  const callbacks = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(engine.injectionCallback[id] ?? {}).map(([event, handlers]) => [
          event,
          (...args: unknown[]) => {
            let result: unknown;
            for (const handler of handlers) {
              const value = handler(...args);
              if (result === undefined) result = value;
            }
            return result;
          },
        ]),
      ),
    [engine, id],
  );

  if (!element || element.hidden) return null;

  return (
    <MaterialView
      resetToken={element}
      root={engine.layouts.some((node) => node.id === id)}
      id={id}
      type={element.type}
      components={components}
      props={{ ...element.props, ...callbacks }}
    >
      {children}
    </MaterialView>
  );
};

const RuntimeTree = ({
  engine,
  components,
}: {
  engine: Engine;
  components: RuntimeComponents;
}): React.JSX.Element => {
  return (
    <>
      {renderLayout(engine.layouts, (node, children) => (
        <RuntimeElement
          key={node.id}
          id={node.id}
          engine={engine}
          components={components}
          tabKey={engine.elements[node.id]?.props.tabKey}
        >
          {children}
        </RuntimeElement>
      ))}
    </>
  );
};

const RuntimeCanvas = ({
  schema,
  materials,
  onFlowError,
}: {
  schema: Schema;
  materials: MaterialRegistry;
  onFlowError?: (error: unknown) => void;
}): React.JSX.Element => {
  const navigation = usePageNavigation();
  const [failedSchema, setFailedSchema] = useState<Schema | null>(null);
  const activeSchema = useRef<Schema | null>(schema);
  const flowErrorHandler = useRef(onFlowError);

  useLayoutEffect(() => {
    flowErrorHandler.current = onFlowError;
  }, [onFlowError]);

  useLayoutEffect(() => {
    activeSchema.current = schema;
    return () => {
      activeSchema.current = null;
    };
  }, [schema]);

  const flowFailed = failedSchema === schema;

  const engine = useMemo(() => {
    const instance = createEngine(schema);
    bindPageNavigation(instance, navigation);
    installMaterialState(instance, materials);
    withFlowEngine({
      engine: instance,
      schema,
      logicNodes: { start: captureRuntimeEvent, ...createLogicNodes() },
      onError: (error) => {
        if (activeSchema.current !== schema) return;
        setFailedSchema(schema);
        flowErrorHandler.current?.(error);
      },
    });
    bindMaterialEventPayloads(instance);
    return instance;
  }, [schema, materials, navigation]);

  useLayoutEffect(() => {
    engine.activate();
    return () => engine.dispose();
  }, [engine]);

  const flowDiagnostic = useMemo<RuntimeDiagnostic | null>(
    () =>
      flowFailed
        ? {
            code: 'FLOW_EXECUTION_ERROR',
            stage: 'event',
            safeMessage: '流程执行失败',
          }
        : null,
    [flowFailed],
  );
  useRuntimeDiagnostic(flowDiagnostic);

  return <RuntimeTree engine={engine} components={materials} />;
};

export interface OrigamixPageProps extends RuntimeDiagnosticsProps {
  schema: Schema;
  materials: MaterialRegistry;
  onFlowError?: (error: unknown) => void;
  renderError?: (error: Error, retry: () => void) => ReactNode;
}

export const OrigamixPage = ({
  schema,
  materials,
  onFlowError,
  onOutcome,
  renderError,
  onDiagnosticsChange,
  onRenderError,
  renderElementError,
}: OrigamixPageProps): React.JSX.Element => {
  return (
    <DiagnosticsProvider
      onOutcome={onOutcome}
      onDiagnosticsChange={onDiagnosticsChange}
      onRenderError={onRenderError}
      renderElementError={renderElementError}
    >
      <RuntimeErrorBoundary renderError={renderError}>
        <RuntimeCanvas schema={schema} materials={materials} onFlowError={onFlowError} />
      </RuntimeErrorBoundary>
    </DiagnosticsProvider>
  );
};
