import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { SchemaUtils, type Flows, type Schema } from '@tangramino/engine';
import { useEditorCore } from '@tangramino/base-editor';
import { useEffect, useState } from 'react';
import type { EditorTool } from '..';
import { GlobalVariablesPanel } from './global-variables-panel';
import { SchemaEditor } from './schema-editor';

const titles: Record<Exclude<EditorTool, 'history'>, string> = {
  globals: '全局变量',
  logic: '逻辑编辑',
  schema: 'Schema 编辑器',
};

export const EditorToolDialog = ({
  tool,
  onClose,
}: {
  tool: Exclude<EditorTool, 'history'> | null;
  onClose: () => void;
}): React.JSX.Element | null => {
  const { schema, setSchema } = useEditorCore();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tool) return;
    const value =
      tool === 'globals'
        ? schema.context?.globalVariables
        : tool === 'logic'
          ? schema.flows
          : schema;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCode(JSON.stringify(value, null, 2));
    setError(null);
  }, [schema, tool]);

  if (!tool) return null;

  const save = (): void => {
    try {
      const parsed = JSON.parse(code) as unknown;
      if (tool === 'globals') {
        if (!Array.isArray(parsed)) throw new Error('全局变量必须是 JSON 数组');
        setSchema({ ...schema, context: { ...schema.context, globalVariables: parsed } });
      } else if (tool === 'logic') {
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
          throw new Error('逻辑配置必须是 JSON 对象');
        setSchema({ ...schema, flows: parsed as Flows });
      } else if (tool === 'schema') {
        setSchema(SchemaUtils.normalizeSchema(parsed as Schema));
      }
      setError(null);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'JSON 格式无效');
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='h-[80vh] w-[60vw] max-w-[60vw] sm:max-w-[60vw]'>
        <DialogHeader>
          <DialogTitle>{titles[tool]}</DialogTitle>
        </DialogHeader>
        {tool === 'globals' ? (
          <GlobalVariablesPanel onSaved={onClose} />
        ) : tool === 'schema' ? (
          <SchemaEditor onSaved={onClose} />
        ) : (
          <>
            <Textarea
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className='min-h-0 flex-1 resize-none font-mono text-xs'
              spellCheck={false}
              aria-label={`${titles[tool]} JSON`}
            />
            {error && <p className='text-sm text-danger'>{error}</p>}
            <DialogFooter>
              <Button variant='outline' onClick={onClose}>
                取消
              </Button>
              <Button onClick={save}>保存</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
