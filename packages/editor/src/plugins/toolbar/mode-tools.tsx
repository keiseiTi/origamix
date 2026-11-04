import { useState } from 'react';
import { Button } from '@origamix/ui';
import { useEditorContext } from '../../hooks/use-editor-context';
import { useEditorSelector } from '../../hooks/use-editor-selector';

export const ModeTools = () => {
  const editor = useEditorContext();
  const mode = useEditorSelector((state) => state.mode);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <div
        role='group'
        aria-label='编辑模式'
        className='flex shrink-0 items-center gap-1 rounded-lg border border-border p-0.5'
      >
        {(['view', 'logic'] as const).map((value) => (
          <Button
            key={value}
            size='sm'
            variant={mode === value ? 'secondary' : 'ghost'}
            aria-pressed={mode === value}
            disabled={switching}
            onClick={() => {
              setSwitching(true);
              setError(null);
              void editor
                .setMode(value)
                .catch((reason: unknown) =>
                  setError(reason instanceof Error ? reason.message : '切换失败，编辑内容已保留'),
                )
                .finally(() => setSwitching(false));
            }}
          >
            {value === 'view' ? '视图' : '逻辑'}
          </Button>
        ))}
      </div>
      {error && (
        <span role='alert' className='max-w-56 truncate text-xs text-destructive' title={error}>
          {error}
        </span>
      )}
    </>
  );
};
