import { Component, useMemo, type ComponentProps, type ErrorInfo, type ReactNode } from 'react';
import { createEngine, type Schema } from '@tangramino/engine';
import { ReactView } from '@tangramino/react';

class RuntimeErrorBoundary extends Component<
  { children: ReactNode; resetKey: string },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }
  componentDidUpdate(previous: Readonly<{ resetKey: string }>): void {
    if (previous.resetKey !== this.props.resetKey && this.state.error)
      this.setState({ error: null });
  }
  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Origamix page render failed', error, info.componentStack);
  }
  render(): ReactNode {
    return this.state.error ? (
      <main role='alert'>页面渲染失败：{this.state.error.message}</main>
    ) : (
      this.props.children
    );
  }
}

export function OrigamixPage({
  schema,
  materials,
}: {
  schema: Schema;
  materials: NonNullable<ComponentProps<typeof ReactView>['components']>;
}): React.JSX.Element {
  const engine = useMemo(() => createEngine(schema), [schema]);
  const resetKey = useMemo(() => JSON.stringify(schema), [schema]);
  const unknown = Object.values(schema.elements)
    .map((element) => element.type)
    .filter((type) => !(type in materials));
  if (unknown.length) return <main role='alert'>未知物料：{[...new Set(unknown)].join('、')}</main>;
  return (
    <RuntimeErrorBoundary resetKey={resetKey}>
      <ReactView engine={engine} components={materials} />
    </RuntimeErrorBoundary>
  );
}
