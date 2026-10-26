import { ORIGAMIX_VERSION } from '@origamix/shared';
import {
  installMaterialState,
  bindMaterialEventPayloads,
  captureRuntimeEvent,
} from './material-state';
import {
  Component,
  useEffect,
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

export interface RuntimeDiagnostic {
  code: 'UNKNOWN_MATERIAL' | 'RENDER_ERROR' | 'FLOW_EXECUTION_ERROR';
  stage: 'material' | 'render' | 'event';
  safeMessage: string;
  materialType?: string;
}

export type RuntimeOutcome =
  | { outcome: 'success'; diagnostics: RuntimeDiagnostic[] }
  | { outcome: 'failed'; diagnostics: RuntimeDiagnostic[] };

export const findUnknownMaterialTypes = (schema: Schema, materials: MaterialRegistry): string[] => {
  return [...new Set(Object.values(schema.elements).map((element) => element.type))].filter(
    (type) => !(type in materials),
  );
};

interface ErrorBoundaryProps {
  children: ReactNode;
  resetKey: string;
  onOutcome?: (outcome: RuntimeOutcome) => void;
  renderError?: (error: Error, retry: () => void) => ReactNode;
}

class RuntimeErrorBoundary extends Component<ErrorBoundaryProps, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidUpdate(previous: Readonly<ErrorBoundaryProps>): void {
    if (previous.resetKey !== this.props.resetKey && this.state.error)
      this.setState({ error: null });
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Origamix page render failed', error, info.componentStack);
    this.props.onOutcome?.({
      outcome: 'failed',
      diagnostics: [{ code: 'RENDER_ERROR', stage: 'render', safeMessage: error.message }],
    });
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    const retry = (): void => this.setState({ error: null });
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
  onOutcome,
}: {
  schema: Schema;
  materials: MaterialRegistry;
  onOutcome?: (outcome: RuntimeOutcome) => void;
}): React.JSX.Element => {
  const [flowError, setFlowError] = useState<{ schema: Schema; message: string } | null>(null);
  const activeSchema = useRef<Schema | null>(schema);
  useLayoutEffect(() => {
    activeSchema.current = schema;
    return () => {
      activeSchema.current = null;
    };
  }, [schema]);
  const executionError = flowError?.schema === schema ? flowError.message : null;
  const engine = useMemo(() => {
    if (
      (schema.extensions?.origamix as { schemaVersion?: unknown } | undefined)?.schemaVersion !==
      ORIGAMIX_VERSION
    )
      throw new Error(
        `页面版本不受支持，请使用 Origamix ${ORIGAMIX_VERSION} 打开页面、保存版本并应用到项目`,
      );
    const instance = createEngine(schema);
    installMaterialState(instance, materials);
    withFlowEngine({
      engine: instance,
      schema,
      logicNodes: { start: captureRuntimeEvent, ...createLogicNodes() },
      onError: (error) => {
        if (activeSchema.current !== schema) return;
        setFlowError({
          schema,
          message: (error instanceof Error ? error.message : '流程执行失败').slice(0, 1800),
        });
      },
    });
    bindMaterialEventPayloads(instance);
    return instance;
  }, [schema, materials]);
  useLayoutEffect(() => {
    engine.activate();
    return () => engine.dispose();
  }, [engine]);
  const unknownTypes = useMemo(
    () => findUnknownMaterialTypes(schema, materials),
    [materials, schema],
  );
  useEffect(() => {
    onOutcome?.(
      executionError
        ? {
            outcome: 'failed',
            diagnostics: [
              { code: 'FLOW_EXECUTION_ERROR', stage: 'event', safeMessage: executionError },
            ],
          }
        : unknownTypes.length
          ? {
              outcome: 'failed',
              diagnostics: unknownTypes.map((materialType) => ({
                code: 'UNKNOWN_MATERIAL',
                stage: 'material',
                materialType,
                safeMessage: `未知物料：${materialType}`,
              })),
            }
          : { outcome: 'success', diagnostics: [] },
    );
  }, [onOutcome, unknownTypes, executionError]);
  if (unknownTypes.length) return <main role='alert'>未知物料：{unknownTypes.join('、')}</main>;
  return (
    <>
      {executionError && <p role='alert'>流程执行失败：{executionError}</p>}
      <RuntimeTree engine={engine} components={materials} />
    </>
  );
};

export interface OrigamixPageProps {
  schema: Schema;
  materials: MaterialRegistry;
  resetKey?: string;
  onOutcome?: (outcome: RuntimeOutcome) => void;
  renderError?: (error: Error, retry: () => void) => ReactNode;
}

export const OrigamixPage = ({
  schema,
  materials,
  resetKey = JSON.stringify(schema),
  onOutcome,
  renderError,
}: OrigamixPageProps): React.JSX.Element => {
  return (
    <RuntimeErrorBoundary resetKey={resetKey} onOutcome={onOutcome} renderError={renderError}>
      <RuntimeCanvas key={resetKey} schema={schema} materials={materials} onOutcome={onOutcome} />
    </RuntimeErrorBoundary>
  );
};
