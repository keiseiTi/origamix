import { useEffect, useEffectEvent, useRef } from 'react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import 'monaco-editor/esm/vs/language/json/monaco.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution.js';
import { cn } from 'cn';
import { usePreferencesStore } from '@/store/preferences';
import './use-monaco-worker';

export interface CodeEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
  language?: string;
  readOnly?: boolean;
  ariaLabel?: string;
}

export const CodeEditor = ({
  value = '',
  onChange,
  className,
  placeholder,
  language = 'json',
  readOnly = false,
  ariaLabel = '代码编辑器',
}: CodeEditorProps): React.JSX.Element => {
  const theme = usePreferencesStore((state) => state.theme);
  const container = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const syncingValue = useRef(false);
  const notifyChange = useEffectEvent((nextValue: string) => onChange?.(nextValue));

  useEffect(() => {
    if (!container.current) return;
    const model = monaco.editor.createModel('', 'json');
    const instance = monaco.editor.create(container.current, {
      model,
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 12,
      scrollBeyondLastLine: false,
      tabSize: 2,
      wordWrap: 'on',
      padding: { top: 12, bottom: 12 },
    });
    editor.current = instance;
    const subscription = instance.onDidChangeModelContent(() => {
      if (!syncingValue.current) notifyChange(instance.getValue());
    });
    return () => {
      subscription.dispose();
      instance.dispose();
      model.dispose();
      editor.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = editor.current;
    if (!instance || instance.getValue() === value) return;
    syncingValue.current = true;
    try {
      instance.setValue(value);
    } finally {
      syncingValue.current = false;
    }
  }, [value]);

  useEffect(() => {
    const model = editor.current?.getModel();
    if (model) monaco.editor.setModelLanguage(model, language);
  }, [language]);

  useEffect(() => {
    editor.current?.updateOptions({ readOnly, domReadOnly: readOnly, ariaLabel, placeholder });
  }, [readOnly, ariaLabel, placeholder]);

  useEffect(() => {
    monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');
  }, [theme]);

  return (
    <div
      className={cn('h-100 min-h-0 min-w-0 w-full overflow-hidden', className)}
      ref={container}
    />
  );
};
