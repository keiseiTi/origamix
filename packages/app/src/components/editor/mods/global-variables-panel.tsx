import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Switch } from '../../ui/switch';
import { Textarea } from '../../ui/textarea';
import { useEditorCore } from '@tangramino/base-editor';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

type VariableType = 'string' | 'number' | 'bool' | 'object' | 'array';
interface GlobalVariable {
  name: string;
  description: string;
  type: VariableType;
  defaultValue: unknown;
}

const emptyVariable = (): GlobalVariable => ({
  name: '',
  description: '',
  type: 'string',
  defaultValue: '',
});

const normalizeVariable = (value: unknown): GlobalVariable => {
  const variable = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const type = ['string', 'number', 'bool', 'object', 'array'].includes(String(variable.type))
    ? (variable.type as VariableType)
    : 'string';
  return {
    name: typeof variable.name === 'string' ? variable.name : '',
    description: typeof variable.description === 'string' ? variable.description : '',
    type,
    defaultValue: variable.defaultValue ?? (type === 'bool' ? false : type === 'number' ? 0 : ''),
  };
};

export const GlobalVariablesPanel = ({ onSaved }: { onSaved: () => void }): React.JSX.Element => {
  const { schema, setSchema } = useEditorCore();
  const [variables, setVariables] = useState<GlobalVariable[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVariables(
      schema.context.globalVariables.length
        ? schema.context.globalVariables.map(normalizeVariable)
        : [emptyVariable()],
    );
  }, [schema.context.globalVariables]);

  const update = (index: number, patch: Partial<GlobalVariable>): void => {
    setVariables((current) =>
      current.map((variable, itemIndex) =>
        itemIndex === index ? { ...variable, ...patch } : variable,
      ),
    );
  };

  const save = (): void => {
    if (variables.some((variable) => !variable.name.trim())) {
      setError('请填写变量名称');
      return;
    }
    setSchema({ ...schema, context: { ...schema.context, globalVariables: variables } });
    setError(null);
    onSaved();
  };

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <div className='min-h-0 flex-1 overflow-auto p-3'>
        <div className='grid grid-cols-1 gap-3 xl:grid-cols-3'>
          {variables.map((variable, index) => (
            <section key={index} className='relative rounded-lg border border-border bg-background p-3'>
              {variables.length > 1 && (
                <Button
                  size='icon-xs'
                  variant='ghost'
                  className='absolute top-2 right-2 text-danger'
                  aria-label={`删除变量 ${variable.name || index + 1}`}
                  onClick={() => setVariables((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2 />
                </Button>
              )}
              <div className='grid grid-cols-2 gap-3 pr-6'>
                <label className='grid gap-1 text-xs'>
                  名称
                  <Input value={variable.name} onChange={(event) => update(index, { name: event.target.value })} />
                </label>
                <label className='grid gap-1 text-xs'>
                  描述
                  <Input value={variable.description} onChange={(event) => update(index, { description: event.target.value })} />
                </label>
                <label className='grid gap-1 text-xs'>
                  类型
                  <Select value={variable.type} onValueChange={(value) => update(index, { type: value as VariableType, defaultValue: value === 'bool' ? false : value === 'number' ? 0 : value === 'array' ? [] : value === 'object' ? {} : '' })}>
                    <SelectTrigger className='w-full'><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='string'>字符串</SelectItem>
                      <SelectItem value='number'>数字</SelectItem>
                      <SelectItem value='bool'>布尔值</SelectItem>
                      <SelectItem value='object'>对象</SelectItem>
                      <SelectItem value='array'>数组</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className='grid gap-1 text-xs'>
                  默认值
                  {variable.type === 'bool' ? (
                    <Switch checked={Boolean(variable.defaultValue)} onCheckedChange={(value) => update(index, { defaultValue: value })} />
                  ) : variable.type === 'object' || variable.type === 'array' ? (
                    <Textarea className='min-h-20 font-mono text-xs' value={JSON.stringify(variable.defaultValue, null, 2)} onChange={(event) => { try { update(index, { defaultValue: JSON.parse(event.target.value) }); } catch { /* Keep the last valid value. */ } }} />
                  ) : (
                    <Input type={variable.type === 'number' ? 'number' : 'text'} value={String(variable.defaultValue ?? '')} onChange={(event) => update(index, { defaultValue: variable.type === 'number' ? Number(event.target.value) : event.target.value })} />
                  )}
                </label>
              </div>
            </section>
          ))}
        </div>
      </div>
      {error && <p className='px-3 text-sm text-danger'>{error}</p>}
      <footer className='flex justify-end gap-2 border-t border-border bg-muted/40 p-3'>
        <Button variant='outline' onClick={() => setVariables((current) => [...current, emptyVariable()])}><Plus />新增全局变量</Button>
        <Button onClick={save}>保存全局变量</Button>
      </footer>
    </div>
  );
};
