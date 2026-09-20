import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { SchemaUtils, type Schema } from '@tangramino/engine';
import { useEditorCore } from '@tangramino/base-editor';
import { Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

export const SchemaEditor = ({ onSaved }: { onSaved: () => void }): React.JSX.Element => {
  const { schema, setSchema } = useEditorCore();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setCode(JSON.stringify(schema, null, 2)), [schema]);

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
    <div className='flex min-h-0 flex-1 flex-col'>
      <Textarea value={code} onChange={(event) => setCode(event.target.value)} className='min-h-0 flex-1 resize-none rounded-none border-0 font-mono text-xs focus-visible:ring-0' spellCheck={false} aria-label='Schema JSON' />
      {error && <p className='px-3 text-sm text-danger'>{error}</p>}
      <footer className='flex justify-end gap-2 border-t border-border bg-muted/40 p-3'>
        <Button variant='outline' onClick={() => void navigator.clipboard.writeText(code)}><Copy />复制 Schema</Button>
        <Button onClick={save}>保存 Schema</Button>
      </footer>
    </div>
  );
};
