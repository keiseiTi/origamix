import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useEditorCore } from '@tangramino/base-editor';
import type { GlobalVariable } from '@tangramino/engine';
import { Plus, Trash2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useState } from 'react';

interface VariableRow {
  id: string;
  variable: GlobalVariable;
  temporary: boolean;
}

const emptyRow = (): VariableRow => ({
  id: nanoid(),
  temporary: true,
  variable: { name: '', description: '', type: 'string', defaultValue: '' },
});

const isEmptyTemporaryRow = ({ temporary, variable }: VariableRow): boolean =>
  temporary &&
  !variable.name.trim() &&
  !variable.description?.trim() &&
  variable.type === 'string' &&
  variable.defaultValue === '';

export const GlobalVariablesPanel = ({ onSaved }: { onSaved: () => void }): React.JSX.Element => {
  const schema = useEditorCore((state) => state.schema);
  const setSchema = useEditorCore((state) => state.setSchema);
  const [rows, setRows] = useState<VariableRow[]>(() =>
    schema.context?.globalVariables?.length
      ? schema.context.globalVariables.map((variable) => ({
          id: nanoid(),
          variable: { ...variable },
          temporary: false,
        }))
      : [emptyRow()],
  );
  const [error, setError] = useState<string | null>(null);

  const update = (id: string, patch: Partial<GlobalVariable>): void => {
    setRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, variable: { ...row.variable, ...patch } } : row,
      ),
    );
    setError(null);
  };

  const insert = (id: string): void => {
    setRows((current) => {
      const index = current.findIndex((row) => row.id === id);
      return [...current.slice(0, index + 1), emptyRow(), ...current.slice(index + 1)];
    });
    setError(null);
  };

  const remove = (id: string): void => {
    setRows((current) => {
      const remaining = current.filter((row) => row.id !== id);
      return remaining.length ? remaining : [emptyRow()];
    });
    setError(null);
  };

  const save = (): void => {
    const variables = rows.filter((row) => !isEmptyTemporaryRow(row)).map((row) => row.variable);
    if (variables.some((variable) => !variable.name.trim())) {
      setError('请填写变量名称；未使用的行可通过删除按钮移除');
      return;
    }
    try {
      setSchema({ ...schema, context: { ...schema.context, globalVariables: variables } });
      setError(null);
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败，请重试');
    }
  };

  return (
    <div className='flex min-h-0 min-w-0 flex-1 flex-col'>
      <div className='min-h-0 flex-1 overflow-auto'>
        <div className='min-w-[720px] p-4'>
          <div
            className='grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_120px_minmax(0,1.2fr)_72px] items-center gap-3 px-3 pb-2 text-xs font-medium text-muted-foreground'
            aria-hidden='true'
          >
            <span>名称</span>
            <span>描述</span>
            <span>类型</span>
            <span>默认值</span>
            <span className='text-center'>操作</span>
          </div>
          <div className='flex flex-col gap-2'>
            {rows.map(({ id, variable }, index) => (
              <section
                key={id}
                aria-label={`全局变量 ${index + 1}`}
                className='grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_120px_minmax(0,1.2fr)_72px] items-center gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:bg-muted/30 focus-within:border-ring'
              >
                <Input
                  aria-label={`变量 ${index + 1} 名称`}
                  placeholder='变量名称'
                  value={variable.name}
                  onChange={(event) => update(id, { name: event.target.value })}
                />
                <Input
                  aria-label={`变量 ${index + 1} 描述`}
                  placeholder='可选描述'
                  value={variable.description ?? ''}
                  onChange={(event) => update(id, { description: event.target.value })}
                />
                <Select
                  items={{
                    string: '字符串',
                    number: '数字',
                    bool: '布尔值',
                    object: '对象',
                    array: '数组',
                  }}
                  value={variable.type}
                  onValueChange={(value) => {
                    if (!value) return;
                    update(id, {
                      type: value,
                      defaultValue: value === 'bool' ? false : value === 'number' ? 0 : '',
                    });
                  }}
                >
                  <SelectTrigger className='w-full' aria-label={`变量 ${index + 1} 类型`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='string'>字符串</SelectItem>
                    <SelectItem value='number'>数字</SelectItem>
                    <SelectItem value='bool'>布尔值</SelectItem>
                  </SelectContent>
                </Select>
                {variable.type === 'bool' ? (
                  <div className='flex h-8 items-center gap-2'>
                    <Switch
                      aria-label={`变量 ${index + 1} 默认值`}
                      checked={Boolean(variable.defaultValue)}
                      onCheckedChange={(value) => update(id, { defaultValue: value })}
                    />
                    <span className='text-xs text-muted-foreground'>
                      {variable.defaultValue ? 'true' : 'false'}
                    </span>
                  </div>
                ) : variable.type === 'object' || variable.type === 'array' ? (
                  <Textarea
                    aria-label={`变量 ${index + 1} 默认值`}
                    className='min-h-8 font-mono text-xs'
                    value={JSON.stringify(variable.defaultValue, null, 2)}
                    onChange={(event) => {
                      try {
                        update(id, { defaultValue: JSON.parse(event.target.value) });
                      } catch {
                        setError('对象或数组默认值必须为有效 JSON');
                      }
                    }}
                  />
                ) : (
                  <Input
                    aria-label={`变量 ${index + 1} 默认值`}
                    placeholder='默认值'
                    type={variable.type === 'number' ? 'number' : 'text'}
                    value={String(variable.defaultValue ?? '')}
                    onChange={(event) =>
                      update(id, {
                        defaultValue:
                          variable.type === 'number'
                            ? Number(event.target.value)
                            : event.target.value,
                      })
                    }
                  />
                )}
                <div className='flex items-center justify-end gap-1'>
                  <Button
                    size='icon-sm'
                    variant='ghost'
                    aria-label={`在变量 ${index + 1} 下新增`}
                    title='在下方新增变量'
                    onClick={() => insert(id)}
                  >
                    <Plus />
                  </Button>
                  <Button
                    size='icon-sm'
                    variant='ghost'
                    className='text-danger hover:bg-danger/10 hover:text-danger'
                    aria-label={`删除变量 ${variable.name || index + 1}`}
                    title='删除变量'
                    onClick={() => remove(id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
      {error && (
        <p role='alert' className='shrink-0 px-4 pb-3 text-sm text-danger'>
          {error}
        </p>
      )}
      <footer className='flex shrink-0 justify-end border-t border-border bg-muted/40 px-4 py-3'>
        <Button onClick={save}>保存全局变量</Button>
      </footer>
    </div>
  );
};
