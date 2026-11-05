import {
  Component,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ErrorInfo,
  type ReactNode,
} from 'react';

export interface RuntimeDiagnostic {
  code: 'UNKNOWN_MATERIAL' | 'RENDER_ERROR' | 'FLOW_EXECUTION_ERROR';
  stage: 'material' | 'render' | 'event';
  safeMessage: string;
  materialType?: string;
  elementId?: string;
  scope?: 'page' | 'layout';
}
export type RuntimeOutcome =
  | { outcome: 'success'; diagnostics: RuntimeDiagnostic[] }
  | { outcome: 'failed'; diagnostics: RuntimeDiagnostic[] };
export interface ElementErrorPresentation {
  diagnostic: RuntimeDiagnostic;
  /** Local debugging only; do not forward raw exceptions through diagnostic transport. */
  error: Error;
  retry: () => void;
}
export interface RuntimeDiagnosticsProps {
  onOutcome?: (outcome: RuntimeOutcome) => void;
  onDiagnosticsChange?: (diagnostics: RuntimeDiagnostic[]) => void;
  renderElementError?: (context: ElementErrorPresentation) => ReactNode;
  onRenderError?: (
    error: Error,
    diagnostic: RuntimeDiagnostic,
    componentStack: string | null,
  ) => void;
}

const createDiagnostics = () => {
  const entries = new Map<object, RuntimeDiagnostic>();
  const listeners = new Set<() => void>();
  let snapshot: RuntimeDiagnostic[] = [];
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: (owner: object, diagnostic: RuntimeDiagnostic | null) => {
      if (diagnostic) entries.set(owner, diagnostic);
      else if (!entries.delete(owner)) return;
      snapshot = [...entries.values()];
      listeners.forEach((listener) => listener());
    },
  };
};
type DiagnosticsStore = ReturnType<typeof createDiagnostics>;
export const DiagnosticsContext = createContext<DiagnosticsStore | null>(null);
export const DiagnosticScopeContext = createContext<'page' | 'layout'>('page');
const PresentationContext = createContext<
  Pick<RuntimeDiagnosticsProps, 'renderElementError' | 'onRenderError'>
>({});

const DiagnosticReporter = ({
  store,
  onOutcome,
  onDiagnosticsChange,
}: RuntimeDiagnosticsProps & { store: DiagnosticsStore }) => {
  const diagnostics = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    // A descendant may report during commit, before this passive effect runs.
    // Read the current snapshot so an initial success cannot overwrite a failure.
    const current = store.getSnapshot();
    onDiagnosticsChange?.([...current]);
    onOutcome?.({ outcome: current.length ? 'failed' : 'success', diagnostics: [...current] });
  }, [store, diagnostics, onOutcome, onDiagnosticsChange]);
  return null;
};
export const DiagnosticsProvider = ({
  children,
  renderElementError,
  onRenderError,
  ...callbacks
}: RuntimeDiagnosticsProps & { children: ReactNode }) => {
  const parentStore = useContext(DiagnosticsContext);
  const parentPresentation = useContext(PresentationContext);
  const localStore = useMemo(createDiagnostics, []);
  const store = parentStore ?? localStore;
  const presentation = useMemo(
    () => ({
      renderElementError: renderElementError ?? parentPresentation.renderElementError,
      onRenderError: onRenderError ?? parentPresentation.onRenderError,
    }),
    [renderElementError, onRenderError, parentPresentation],
  );
  return (
    <DiagnosticsContext.Provider value={store}>
      <PresentationContext.Provider value={presentation}>{children}</PresentationContext.Provider>
      {!parentStore && <DiagnosticReporter store={store} {...callbacks} />}
    </DiagnosticsContext.Provider>
  );
};
export const useRuntimeDiagnostic = (diagnostic: RuntimeDiagnostic | null): void => {
  const store = useContext(DiagnosticsContext);
  useEffect(() => {
    const owner = {};
    if (diagnostic) store?.set(owner, diagnostic);
    return () => store?.set(owner, null);
  }, [store, diagnostic]);
};

export class UnknownMaterialError extends Error {}
interface MaterialBoundaryProps {
  children: ReactNode;
  id: string;
  type: string;
  resetToken: unknown;
  material: unknown;
  scope?: 'page' | 'layout';
  fallback: (content: ReactNode) => ReactNode;
  renderError?: RuntimeDiagnosticsProps['renderElementError'];
  onRenderError?: RuntimeDiagnosticsProps['onRenderError'];
}
class MaterialBoundary extends Component<MaterialBoundaryProps, { error: Error | null }> {
  static contextType = DiagnosticsContext;
  declare context: React.ContextType<typeof DiagnosticsContext>;
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: unknown): { error: Error } {
    return { error: error instanceof Error ? error : new Error('物料渲染失败') };
  }
  private diagnostic = (): RuntimeDiagnostic => ({
    code: this.state.error instanceof UnknownMaterialError ? 'UNKNOWN_MATERIAL' : 'RENDER_ERROR',
    stage: this.state.error instanceof UnknownMaterialError ? 'material' : 'render',
    elementId: this.props.id,
    materialType: this.props.type,
    scope: this.props.scope ?? 'page',
    safeMessage:
      this.state.error instanceof UnknownMaterialError
        ? `未知物料：${this.props.type}`
        : '物料渲染失败，请检查属性或重试',
  });
  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Origamix material render failed', error, info.componentStack);
    const diagnostic = this.diagnostic();
    this.context?.set(this, diagnostic);
    this.props.onRenderError?.(error, diagnostic, info.componentStack ?? null);
  }
  componentDidUpdate(previous: MaterialBoundaryProps): void {
    if (
      previous.resetToken !== this.props.resetToken ||
      previous.material !== this.props.material ||
      previous.type !== this.props.type ||
      previous.id !== this.props.id
    ) {
      if (this.state.error) this.retry();
    }
  }
  componentWillUnmount(): void {
    this.context?.set(this, null);
  }
  private retry = (): void => {
    // Clear the old failure before rendering; a failed retry reports a new one.
    this.context?.set(this, null);
    this.setState({ error: null });
  };
  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    const diagnostic = this.diagnostic();
    const content = this.props.renderError ? (
      this.props.renderError({ diagnostic, error: this.state.error, retry: this.retry })
    ) : (
      <div role='alert' className='rounded border border-current p-2 text-sm'>
        <p>
          {diagnostic.materialType}（{diagnostic.elementId}）：{diagnostic.safeMessage}
        </p>
        <details>
          <summary>错误详情</summary>
          <pre className='whitespace-pre-wrap break-words'>
            {this.state.error.message.slice(0, 1800)}
          </pre>
        </details>
        <button
          type='button'
          onClick={this.retry}
          className='rounded border border-current px-2 py-1 hover:opacity-80 focus-visible:outline focus-visible:outline-2'
        >
          重试
        </button>
      </div>
    );
    return this.props.fallback(content);
  }
}
export const MaterialErrorBoundary = (props: MaterialBoundaryProps) => {
  const { renderElementError, onRenderError } = useContext(PresentationContext);
  const scope = useContext(DiagnosticScopeContext);
  return (
    <MaterialBoundary
      {...props}
      scope={scope}
      renderError={renderElementError}
      onRenderError={onRenderError}
    />
  );
};
