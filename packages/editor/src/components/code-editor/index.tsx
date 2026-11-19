import { useEffect, useState } from 'react';
import { Spinner, Textarea, cn } from '@origamix/ui';
import type { EditorTheme } from '../../interfaces/editor';
import { useEditorTheme } from '../../session/editor-environment';

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

// A browser can retain a failed module import for this document's lifetime.
const loadMonaco = (): Promise<MonacoView> =>
  (pending ??= import('./monaco-editor').then(({ MonacoEditor }) => MonacoEditor));

const PlainTextEditor = ({
  theme,
  value = '',
  onChange,
  className,
  placeholder,
  readOnly = false,
  ariaLabel = '代码编辑器',
}: CodeEditorProps): React.JSX.Element => {
  const inheritedTheme = useEditorTheme();
  return (
    <div
      className={cn(
        'origamix-ui flex h-100 min-h-0 min-w-0 w-full flex-col gap-1 overflow-hidden',
        (theme ?? inheritedTheme) === 'dark' && 'dark',
        className,
      )}
    >
      <p role='status' className='shrink-0 px-2 pt-1 text-xs text-muted-foreground'>
        代码编辑器加载失败，已切换为纯文本模式。
      </p>
      <Textarea
        aria-label={ariaLabel}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.currentTarget.value)}
        spellCheck={false}
        autoCapitalize='off'
        className='min-h-0 flex-1 resize-none field-sizing-fixed rounded-none font-mono text-xs md:text-xs'
      />
    </div>
  );
};

export const CodeEditor = (props: CodeEditorProps): React.JSX.Element => {
  const [View, setView] = useState<MonacoView | 'unavailable' | null>(null);
  useEffect(() => {
    let active = true;
    void loadMonaco().then(
      (view) => {
        if (active) setView(() => view);
      },
      () => {
        if (active) setView('unavailable');
      },
    );
    return () => {
      active = false;
    };
  }, []);
  if (View === 'unavailable') return <PlainTextEditor {...props} />;
  if (View) return <View {...props} />;
  return (
    <div
      className={cn(
        'grid h-100 min-h-0 min-w-0 w-full place-content-center gap-2 overflow-hidden p-2 text-center text-xs',
        props.className,
      )}
    >
      <div role='status'>
        <Spinner aria-label='加载代码编辑器' />
      </div>
    </div>
  );
};
