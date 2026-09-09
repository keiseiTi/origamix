import { Button } from '@heroui/react';
import { createEngine, type Schema } from '@tangramino/engine';
import { ReactView } from '@tangramino/react';
import materialComponents from '@origamix/materials/antd';
import { Component, useEffect, useMemo, type ErrorInfo, type ReactNode } from 'react';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import type { PreviewRenderDiagnostic } from '@origamix/shared/page-window';

type RenderOutcome =
  | { outcome: 'success'; diagnostics: PreviewRenderDiagnostic[] }
  | { outcome: 'failed'; diagnostics: PreviewRenderDiagnostic[] };

class PreviewErrorBoundary extends Component<
  { children: ReactNode; resetKey: string; onOutcome?: (outcome: RenderOutcome) => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidUpdate(previous: Readonly<{ children: ReactNode; resetKey: string }>): void {
    if (previous.resetKey !== this.props.resetKey && this.state.error)
      this.setState({ error: null });
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('页面预览渲染失败', error, info.componentStack);
    this.props.onOutcome?.({
      outcome: 'failed',
      diagnostics: [
        {
          code: 'RENDER_ERROR',
          severity: 'error',
          stage: 'render',
          safeMessage: error.message || '页面渲染失败',
        },
      ],
    });
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          role='alert'
          className='m-auto max-w-lg rounded-xl border border-danger/30 bg-danger/10 p-5 text-sm text-danger'
        >
          <strong className='block'>页面渲染失败</strong>
          <span className='mt-1 block'>{this.state.error.message}</span>
          <Button
            className='mt-4'
            size='sm'
            variant='secondary'
            onPress={() => this.setState({ error: null })}
          >
            重试渲染
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

function PreviewCanvas({
  schema,
  onOutcome,
}: {
  schema: OrigamixPageSchema;
  onOutcome?: (outcome: RenderOutcome) => void;
}): React.JSX.Element {
  const engine = useMemo(() => createEngine(schema as Schema), [schema]);
  const unknownTypes = useMemo(
    () =>
      [...new Set(Object.values(schema.elements).map((element) => element.type))].filter(
        (type) => !(type in materialComponents),
      ),
    [schema],
  );
  useEffect(() => {
    if (unknownTypes.length) {
      onOutcome?.({
        outcome: 'failed',
        diagnostics: unknownTypes.map((materialType) => ({
          code: 'UNKNOWN_MATERIAL',
          severity: 'error',
          stage: 'material',
          materialType,
          safeMessage: `无法预览未注册物料：${materialType}`,
        })),
      });
    } else {
      onOutcome?.({ outcome: 'success', diagnostics: [] });
    }
  }, [onOutcome, unknownTypes]);

  if (unknownTypes.length) {
    return (
      <div
        role='alert'
        className='m-auto max-w-lg rounded-xl border border-warning/30 bg-warning/10 p-5 text-sm text-warning-foreground'
      >
        无法预览未注册物料：{unknownTypes.join('、')}
      </div>
    );
  }

  return (
    <div className='size-full overflow-auto bg-white dark:bg-zinc-950'>
      <ReactView engine={engine} components={materialComponents} />
    </div>
  );
}

export function RuntimePreview({
  schema,
  revisionId,
  onOutcome,
}: {
  schema: OrigamixPageSchema;
  revisionId: string;
  onOutcome?: (outcome: RenderOutcome) => void;
}): React.JSX.Element {
  return (
    <PreviewErrorBoundary resetKey={revisionId} onOutcome={onOutcome}>
      <PreviewCanvas schema={schema} onOutcome={onOutcome} />
    </PreviewErrorBoundary>
  );
}
