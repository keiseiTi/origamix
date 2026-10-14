import { Button } from '@/components/ui/button';
import { CodeEditor } from './code-editor';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { SchemaUtils, type Schema } from '@tangramino/engine';
import { useEditorCore } from '@tangramino/base-editor';
import { Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

export const SchemaEditor = ({ onSaved }: { onSaved: () => void }): React.JSX.Element => {
  const schema = useEditorCore((state) => state.schema);
  const setSchema = useEditorCore((state) => state.setSchema);
  const [code, setCode] = useState(() => JSON.stringify(schema, null, 2));
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCode(JSON.stringify(schema, null, 2));
  }, [schema]);

  const save = (): void => {
    try {
      setSchema(SchemaUtils.normalizeSchema(JSON.parse(code) as Schema));
      setError(null);
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Schema JSON 解析失败');
    }
  };

  return (
    <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
      <CodeEditor
        value={code}
        onChange={(value) => {
          setCode(value);
          setCopyStatus(null);
        }}
        className='h-0 flex-1'
        language='json'
        ariaLabel='Schema JSON'
      />
      {copyStatus && (
        <p role='status' className='px-3 text-sm text-muted-foreground'>
          {copyStatus}
        </p>
      )}
      {error && <p className='px-3 text-sm text-danger'>{error}</p>}
      <footer className='flex shrink-0 justify-end gap-2 border-t border-border bg-muted/40 p-3'>
        <CopyToClipboard
          text={code}
          onCopy={(_text, success) =>
            setCopyStatus(success ? 'Schema 已复制' : '复制失败，请在编辑器中全选后复制')
          }
        >
          <Button variant='outline'>
            <Copy />
            复制 Schema
          </Button>
        </CopyToClipboard>
        <Button onClick={save}>保存 Schema</Button>
      </footer>
    </div>
  );
};
