import { Button, Spinner } from '@origamix/ui';
import { loadRuntimeMaterials } from '@/materials/loaders';
import {
  type ProjectStack,
  type OrigamixPageSchema,
  type PreviewRenderDiagnostic,
} from '@origamix/shared';
import { useEffect, useMemo, useState } from 'react';

import { OrigamixPage, type RuntimeOutcome } from '@origamix/runtime/react';
import type { Schema } from '@tangramino/engine';

type RenderOutcome =
  | { outcome: 'success'; diagnostics: PreviewRenderDiagnostic[] }
  | { outcome: 'failed'; diagnostics: PreviewRenderDiagnostic[] };

const toPreviewOutcome = (outcome: RuntimeOutcome): RenderOutcome => {
  return {
    outcome: outcome.outcome,
    diagnostics: outcome.diagnostics.map((diagnostic) => ({ ...diagnostic, severity: 'error' })),
  };
};

export const RuntimePreview = ({
  schema,
  stack,
  revisionId,
  onOutcome,
}: {
  schema: OrigamixPageSchema;
  stack: ProjectStack;
  revisionId: string;
  onOutcome?: (outcome: RenderOutcome) => void;
}): React.JSX.Element => {
  const key = JSON.stringify(stack ?? null);
  const [attempt, setAttempt] = useState(0);
  const scope = useMemo(() => ({ key, attempt }), [key, attempt]);
  const [loaded, setLoaded] = useState<{
    scope: typeof scope;
    materials?: Awaited<ReturnType<typeof loadRuntimeMaterials>>;
    error?: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    loadRuntimeMaterials(JSON.parse(scope.key) as ProjectStack)
      .then((materials) => {
        if (active) setLoaded({ scope, materials });
      })
      .catch((reason: unknown) => {
        if (active)
          setLoaded({
            scope,
            error: reason instanceof Error ? reason.message : '无法加载运行物料',
          });
      });
    return () => {
      active = false;
    };
  }, [scope]);
  const current = loaded?.scope === scope ? loaded : null;
  if (current?.error)
    return (
      <div
        role='alert'
        className='grid h-screen place-content-center gap-3 p-6 text-sm text-danger'
      >
        <span>{current.error}。页面草稿已保留。</span>
        <Button variant='secondary' onClick={() => setAttempt((value) => value + 1)}>
          重试加载物料
        </Button>
      </div>
    );
  if (!current?.materials)
    return (
      <div className='grid h-screen place-items-center'>
        <Spinner aria-label='加载运行物料' />
      </div>
    );
  return (
    <div className='size-full overflow-auto bg-white dark:bg-zinc-950'>
      <OrigamixPage
        schema={schema as Schema}
        materials={current.materials}
        resetKey={revisionId}
        onOutcome={(outcome) => onOutcome?.(toPreviewOutcome(outcome))}
        renderError={(error, retry) => (
          <div
            role='alert'
            className='m-auto max-w-lg rounded-xl border border-danger/30 bg-danger/10 p-5 text-sm text-danger'
          >
            <strong className='block'>页面渲染失败</strong>
            <span className='mt-1 block'>{error.message}</span>
            <Button className='mt-4' size='sm' variant='secondary' onClick={retry}>
              重试渲染
            </Button>
          </div>
        )}
      />
    </div>
  );
};
