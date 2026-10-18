import {
  Component,
  useEffect,
  useMemo,
  useState,
  useRef,
  useLayoutEffect,
  type ComponentProps,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { createLogicNodes } from './logic-nodes';
import { createEngine, withFlowEngine, type Schema } from '@tangramino/engine';
import { ReactView } from '@tangramino/react';

export interface RuntimeDiagnostic {
  code: 'UNKNOWN_MATERIAL' | 'RENDER_ERROR' | 'FLOW_EXECUTION_ERROR';
  stage: 'material' | 'render' | 'event';
  safeMessage: string;
  materialType?: string;
}

export type RuntimeOutcome =
  | { outcome: 'success'; diagnostics: RuntimeDiagnostic[] }
  | { outcome: 'failed'; diagnostics: RuntimeDiagnostic[] };

export const findUnknownMaterialTypes = (
  schema: Schema,
  materials: NonNullable<ComponentProps<typeof ReactView>['components']>,
): string[] => {
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

const RuntimeCanvas = ({
  schema,
  materials,
  onOutcome,
}: {
  schema: Schema;
  materials: NonNullable<ComponentProps<typeof ReactView>['components']>;
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
    const instance = createEngine(schema);
    // Engine's legacy object-variable initializer evaluates JavaScript. Initialize
    // declarative JSON here and give the event adapter no executable defaults.
    for (const variable of schema.context?.globalVariables ?? []) {
      let value: unknown = variable.defaultValue;
      if (variable.type === 'object' || variable.type === 'array') {
        try {
          value = JSON.parse(String(value));
        } catch {
          value = undefined;
        }
      }
      instance.setGlobalVariable(variable.name, value);
    }
    withFlowEngine({
      engine: instance,
      schema: { ...schema, context: { globalVariables: [] } },
      logicNodes: createLogicNodes((error) => {
        if (activeSchema.current !== schema) return;
        setFlowError({
          schema,
          message: (error instanceof Error ? error.message : '流程执行失败').slice(0, 1800),
        });
      }),
    });
    return instance;
  }, [schema]);
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
      <ReactView engine={engine} components={materials} />
    </>
  );
};

export const OrigamixPage = ({
  schema,
  materials,
  resetKey = JSON.stringify(schema),
  onOutcome,
  renderError,
}: {
  schema: Schema;
  materials: NonNullable<ComponentProps<typeof ReactView>['components']>;
  resetKey?: string;
  onOutcome?: (outcome: RuntimeOutcome) => void;
  renderError?: (error: Error, retry: () => void) => ReactNode;
}): React.JSX.Element => {
  return (
    <RuntimeErrorBoundary resetKey={resetKey} onOutcome={onOutcome} renderError={renderError}>
      <RuntimeCanvas schema={schema} materials={materials} onOutcome={onOutcome} />
    </RuntimeErrorBoundary>
  );
};
