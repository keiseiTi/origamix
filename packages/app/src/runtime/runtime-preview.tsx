import { Button } from '../components/ui/button';
import materialComponents from '@origamix/materials/antd';
import { OrigamixPage, type RuntimeOutcome } from '@origamix/runtime/react';
import type { Schema } from '@tangramino/engine';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import type { PreviewRenderDiagnostic } from '@origamix/shared/page-window';

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
  revisionId,
  onOutcome,
}: {
  schema: OrigamixPageSchema;
  revisionId: string;
  onOutcome?: (outcome: RenderOutcome) => void;
}): React.JSX.Element => {
  return (
    <div className='size-full overflow-auto bg-white dark:bg-zinc-950'>
      <OrigamixPage
        schema={schema as Schema}
        materials={materialComponents}
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
