import { Choice } from './choice';
import { validateAntdMaterialProps } from '../antd/validation';
import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Settings2, Trash2 } from 'lucide-react';
import {
  Button,
  Checkbox,
  Input,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@origamix/ui';

type Row = Record<string, unknown>;
type DraftRow = { id: string; option: Row };
export interface CollectionEditorProps {
  value?: unknown;
  onChange?: (value: unknown) => void;
}
const readOptions = (value: unknown): Row[] =>
  Array.isArray(value)
    ? value.map((item) =>
        typeof item === 'object' && item !== null
          ? { ...item }
          : { label: String(item), value: item },
      )
    : [];
const validateOptions = (rows: Row[]): string | undefined => {
  for (const row of rows) {
    if (
      typeof row.label !== 'string' ||
      !row.label.trim() ||
      !['string', 'number', 'boolean'].includes(typeof row.value) ||
      row.value === '' ||
      (typeof row.value === 'number' && !Number.isFinite(row.value))
    )
      return '请填写选项名称和有效的值。';
  }
  return validateAntdMaterialProps('select', { options: rows })[0]?.message;
};

const CollectionEditor = ({
  value,
  onChange,
  allowBoolean = true,
}: CollectionEditorProps & { allowBoolean?: boolean }) => {
  const options = readOptions(value);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftRow[]>([]);
  const [error, setError] = useState<string>();
  const validate = (rows: Row[]) =>
    !allowBoolean && rows.some((row) => typeof row.value === 'boolean')
      ? '下拉选项值请使用文本或数字。'
      : validateOptions(rows);
  const change = (id: string, field: string, value: unknown) => {
    setDraft((rows) =>
      rows.map((row) =>
        row.id === id ? { ...row, option: { ...row.option, [field]: value } } : row,
      ),
    );
    setError(undefined);
  };
  const move = (index: number, offset: number) =>
    setDraft((rows) => {
      const next = [...rows];
      [next[index], next[index + offset]] = [next[index + offset]!, next[index]!];
      return next;
    });
  const commit = (rows: Row[]) => {
    const issue = validate(rows);
    setError(issue);
    if (issue) return;
    onChange?.(rows);
    setOpen(false);
  };
  return (
    <div className='min-w-0 space-y-2'>
      <div className='overflow-hidden rounded-md border border-border'>
        <table className='w-full table-fixed text-left text-xs'>
          <caption className='sr-only'>选项配置概览</caption>
          <thead className='bg-muted/50 text-muted-foreground'>
            <tr>
              <th scope='col' className='w-2/5 px-2 py-2 font-medium'>
                选项名
              </th>
              <th scope='col' className='px-2 py-2 font-medium'>
                值
              </th>
              <th scope='col' className='w-12 px-1 py-2 text-center font-medium'>
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {options.length ? (
              options.map((option, index) => (
                <tr key={index} className='border-t border-border hover:bg-muted/30'>
                  <td className='truncate px-2 py-1.5' title={String(option.label ?? '')}>
                    {String(option.label ?? '') || '未命名'}
                  </td>
                  <td
                    className='truncate px-2 py-1.5 text-muted-foreground'
                    title={String(option.value ?? '')}
                  >
                    {String(option.value ?? '') || '—'}
                  </td>
                  <td className='px-1 py-1 text-center'>
                    <Button
                      type='button'
                      size='icon-xs'
                      variant='ghost'
                      disabled={!onChange}
                      aria-label={`删除选项 ${index + 1}：${String(option.label ?? '未命名')}`}
                      title='删除选项'
                      className='text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                      onClick={() => commit(options.filter((_, i) => i !== index))}
                    >
                      <Trash2 className='size-3.5' />
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className='px-2 py-5 text-center text-muted-foreground'>
                  暂无选项，请配置选项。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!open && error && (
        <p role='alert' className='text-xs text-destructive'>
          {error}
        </p>
      )}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next)
            setDraft(readOptions(value).map((option) => ({ id: crypto.randomUUID(), option })));
          setError(undefined);
          setOpen(next);
        }}
      >
        <DialogTrigger
          render={
            <Button
              type='button'
              size='sm'
              variant='outline'
              className='w-full'
              disabled={!onChange}
            />
          }
        >
          <Settings2 className='size-3.5' />
          配置选项
        </DialogTrigger>
        <DialogContent className='flex max-h-[85dvh] flex-col sm:max-w-4xl'>
          <DialogHeader>
            <DialogTitle>配置选项</DialogTitle>
            <DialogDescription>
              编辑选项名称、值、顺序及禁用状态，确认后生效；取消将放弃本次修改。
            </DialogDescription>
          </DialogHeader>
          <div className='min-h-0 overflow-auto rounded-md border border-border'>
            <table className='w-full min-w-[700px] table-fixed text-left text-xs'>
              <caption className='sr-only'>编辑选项</caption>
              <thead className='sticky top-0 z-10 bg-muted text-muted-foreground'>
                <tr>
                  {['选项名', '值类型', '值', '禁用', '操作'].map((label) => (
                    <th key={label} scope='col' className='px-2 py-2.5 font-medium'>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draft.map(({ id, option }, index) => (
                  <tr key={id} className='border-t border-border hover:bg-muted/20'>
                    <td className='p-2'>
                      <Input
                        aria-label={`选项 ${index + 1} 名称`}
                        value={String(option.label ?? '')}
                        onChange={(event) => change(id, 'label', event.target.value)}
                      />
                    </td>
                    <td className='p-2'>
                      <Choice
                        label={`选项 ${index + 1} 值类型`}
                        value={typeof option.value}
                        options={[
                          { label: '文本', value: 'string' },
                          { label: '数字', value: 'number' },
                          ...(allowBoolean ? [{ label: '布尔值', value: 'boolean' }] : []),
                        ]}
                        onChange={(type) =>
                          change(
                            id,
                            'value',
                            type === 'number'
                              ? 0
                              : type === 'boolean'
                                ? false
                                : String(option.value ?? ''),
                          )
                        }
                      />
                    </td>
                    <td className='p-2'>
                      {typeof option.value === 'boolean' ? (
                        <Checkbox
                          aria-label={`选项 ${index + 1} 值`}
                          checked={option.value}
                          onCheckedChange={(next) => change(id, 'value', Boolean(next))}
                        />
                      ) : (
                        <Input
                          aria-label={`选项 ${index + 1} 值`}
                          type={typeof option.value === 'number' ? 'number' : 'text'}
                          value={String(option.value ?? '')}
                          onChange={(event) =>
                            change(
                              id,
                              'value',
                              typeof option.value === 'number'
                                ? event.target.value === ''
                                  ? NaN
                                  : Number(event.target.value)
                                : event.target.value,
                            )
                          }
                        />
                      )}
                    </td>
                    <td className='p-2'>
                      <Checkbox
                        aria-label={`选项 ${index + 1} 禁用`}
                        checked={Boolean(option.disabled)}
                        onCheckedChange={(next) => change(id, 'disabled', Boolean(next))}
                      />
                    </td>
                    <td className='p-2'>
                      <div className='flex gap-1'>
                        <Button
                          type='button'
                          size='icon-xs'
                          variant='ghost'
                          disabled={index === 0}
                          aria-label={`上移选项 ${index + 1}`}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp className='size-3.5' />
                        </Button>
                        <Button
                          type='button'
                          size='icon-xs'
                          variant='ghost'
                          disabled={index === draft.length - 1}
                          aria-label={`下移选项 ${index + 1}`}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown className='size-3.5' />
                        </Button>
                        <Button
                          type='button'
                          size='icon-xs'
                          variant='ghost'
                          aria-label={`删除选项草稿 ${index + 1}`}
                          onClick={() => {
                            setDraft((rows) => rows.filter((row) => row.id !== id));
                            setError(undefined);
                          }}
                        >
                          <Trash2 className='size-3.5' />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!draft.length && (
                  <tr>
                    <td colSpan={5} className='px-2 py-6 text-center text-muted-foreground'>
                      暂无选项，请添加。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Button
            type='button'
            size='sm'
            variant='outline'
            className='self-start'
            onClick={() => {
              setDraft((rows) => [
                ...rows,
                { id: crypto.randomUUID(), option: { label: '', value: '' } },
              ]);
              setError(undefined);
            }}
          >
            <Plus className='size-3.5' />
            添加选项
          </Button>
          {error && (
            <p role='alert' className='text-xs text-destructive'>
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type='button' variant='outline' onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type='button' onClick={() => commit(draft.map((row) => row.option))}>
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const OptionsEditor = (props: CollectionEditorProps) => <CollectionEditor {...props} />;
export { ColumnsEditor } from './columns-editor';
export const SelectOptionsEditor = (props: CollectionEditorProps) => (
  <CollectionEditor {...props} allowBoolean={false} />
);
