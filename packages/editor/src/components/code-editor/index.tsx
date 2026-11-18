import { useEffect, useState } from 'react';
import { Button, Spinner, cn } from '@origamix/ui';
import type { EditorTheme } from '../../interfaces/editor';

export interface CodeEditorProps {
  theme?: EditorTheme;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
  language?: string;
  readOnly?: boolean;
  ariaLabel?: string;
}

type MonacoView = (typeof import('./monaco-editor'))['MonacoEditor'];
let pending: Promise<MonacoView> | undefined;

const loadMonaco = (): Promise<MonacoView> => {
  pending ??= import('./monaco-editor')
    .then(({ MonacoEditor }) => MonacoEditor)
    .catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
  return pending;
};

export const CodeEditor = (props: CodeEditorProps): React.JSX.Element => {
  const [View, setView] = useState<MonacoView | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void loadMonaco().then(
      (view) => {
        if (active) setView(() => view);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);
  if (View) return <View {...props} />;
  return (
    <div
      className={cn(
        'grid h-100 min-h-0 min-w-0 w-full place-content-center gap-2 overflow-hidden p-2 text-center text-xs',
        props.className,
      )}
    >
      {failed ? (
        <>
          <p role='alert' className='text-destructive'>
            代码编辑器加载失败，请重试。
          </p>
          <Button
            size='sm'
            variant='outline'
            onClick={() => {
              setFailed(false);
              setAttempt((value) => value + 1);
            }}
          >
            重试加载
          </Button>
        </>
      ) : (
        <div role='status'>
          <Spinner aria-label='加载代码编辑器' />
        </div>
      )}
    </div>
  );
};
