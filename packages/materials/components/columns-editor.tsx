import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Settings2, Trash2 } from 'lucide-react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@origamix/ui';
import { validateColumns } from '../antd/structured-data-validation';
import type { CollectionEditorProps } from './collection-editor';

type Column = Record<string, unknown>;
type DraftColumn = { id: string; column: Column };
const readColumns = (value: unknown): Column[] =>
  Array.isArray(value)
    ? value.map((column) =>
        column && typeof column === 'object' && !Array.isArray(column)
          ? { ...column }
          : { title: '', dataIndex: '' },
      )
    : [];

const ColumnChoice = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}) => (
  <Select
    items={options}
    value={value}
    onValueChange={(next) => {
      if (next !== null) onChange(next);
    }}
  >
    <SelectTrigger aria-label={label} className='w-full'>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {options.map((option) => (
        <SelectItem key={option.value} value={option.value}>
          {option.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

export const ColumnsEditor = ({ value, onChange }: CollectionEditorProps) => {
  const columns = readColumns(value);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftColumn[]>([]);
  const [error, setError] = useState<string>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const change = (id: string, field: string, next: unknown) => {
    setDraft((previous) =>
      previous.map((row) => {
        if (row.id !== id) return row;
        const column = { ...row.column, [field]: next };
        if (next === undefined) delete column[field];
        return { ...row, column };
      }),
    );
    setError(undefined);
  };
  const remove = (id: string) => {
    setDraft((previous) => previous.filter((row) => row.id !== id));
    setError(undefined);
  };
  const move = (index: number, offset: number) => {
    setDraft((previous) => {
      const target = index + offset;
      if (target < 0 || target >= previous.length) return previous;
      const next = [...previous];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };
  const commit = (next: Column[], deletedIndex?: number) => {
    // The host remounts custom controls after a value commit; focus their replacement controls.
    const host = triggerRef.current?.parentElement?.parentElement;
    onChange?.(next);
    requestAnimationFrame(() => {
      const deletes = host?.querySelectorAll<HTMLButtonElement>('[data-column-delete]');
      const target =
        deletedIndex !== undefined && deletes?.length
          ? deletes[Math.min(deletedIndex, deletes.length - 1)]
          : host?.querySelector<HTMLButtonElement>('[data-columns-trigger]');
      target?.focus();
    });
  };
  const confirm = () => {
    const next = draft.map((row) => row.column);
    const issue = validateColumns(next);
    if (issue) {
      setError(issue);
      return;
    }
    setOpen(false);
    commit(next);
  };
  const deleteColumn = (index: number) => {
    const next = columns.filter((_, rowIndex) => rowIndex !== index);
    const issue = validateColumns(next);
    if (issue) {
      setError(issue);
      return;
    }
    setError(undefined);
    commit(next, index);
  };
  return (
    <div className='min-w-0 space-y-2'>
      <div className='overflow-hidden rounded-md border border-border'>
        <table className='w-full table-fixed text-left text-xs'>
          <caption className='sr-only'>列配置概览</caption>
          <thead className='bg-muted/50 text-muted-foreground'>
            <tr>
              <th scope='col' className='w-2/5 px-2 py-2 font-medium'>
                列名
              </th>
              <th scope='col' className='px-2 py-2 font-medium'>
                字段
              </th>
              <th scope='col' className='w-12 px-1 py-2 text-center font-medium'>
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {columns.length ? (
              columns.map((column, index) => (
                <tr key={index} className='border-t border-border hover:bg-muted/30'>
                  <td className='truncate px-2 py-1.5' title={String(column.title ?? '')}>
                    {String(column.title ?? '') || '未命名'}
                  </td>
                  <td
                    className='truncate px-2 py-1.5 text-muted-foreground'
                    title={String(column.dataIndex ?? '')}
                  >
                    {String(column.dataIndex ?? '') || '—'}
                  </td>
                  <td className='px-1 py-1 text-center'>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon-xs'
                      disabled={!onChange}
                      data-column-delete
                      aria-label={`删除列 ${index + 1}：${String(column.title ?? '未命名')}`}
                      title='删除列'
                      className='text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                      onClick={() => deleteColumn(index)}
                    >
                      <Trash2 className='size-3.5' />
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className='px-2 py-5 text-center text-muted-foreground'>
                  暂无列，请配置列。
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
          if (next) {
            setDraft(readColumns(value).map((column) => ({ id: crypto.randomUUID(), column })));
          }
          setError(undefined);
          setOpen(next);
        }}
      >
        <DialogTrigger
          render={
            <Button
              ref={triggerRef}
              type='button'
              variant='outline'
              size='sm'
              className='w-full'
              data-columns-trigger
              disabled={!onChange}
            />
          }
        >
          <Settings2 className='size-3.5' />
          配置列
        </DialogTrigger>
        <DialogContent className='flex max-h-[85dvh] flex-col sm:max-w-6xl'>
          <DialogHeader>
            <DialogTitle>配置列</DialogTitle>
            <DialogDescription>
              编辑列属性和顺序，确认后更新表格；取消将放弃本次修改。
            </DialogDescription>
          </DialogHeader>
          <div className='min-h-0 overflow-auto rounded-md border border-border'>
            <table className='w-full min-w-[940px] table-fixed text-left text-xs'>
              <caption className='sr-only'>编辑表格列</caption>
              <thead className='sticky top-0 z-10 bg-muted text-muted-foreground'>
                <tr>
                  <th scope='col' className='w-[18%] px-2 py-2.5 font-medium'>
                    列名
                  </th>
                  <th scope='col' className='w-[18%] px-2 py-2.5 font-medium'>
                    字段
                  </th>
                  <th scope='col' className='w-[11%] px-2 py-2.5 font-medium'>
                    宽度
                  </th>
                  <th scope='col' className='w-[15%] px-2 py-2.5 font-medium'>
                    对齐
                  </th>
                  <th scope='col' className='w-[15%] px-2 py-2.5 font-medium'>
                    固定
                  </th>
                  <th scope='col' className='w-[10%] px-2 py-2.5 text-center font-medium'>
                    超出省略
                  </th>
                  <th scope='col' className='px-2 py-2.5 text-center font-medium'>
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {draft.length ? (
                  draft.map(({ id, column }, index) => (
                    <tr key={id} className='border-t border-border hover:bg-muted/30'>
                      <td className='p-2'>
                        <Input
                          aria-label={`列名 ${index + 1}`}
                          value={String(column.title ?? '')}
                          placeholder='请输入列名'
                          onChange={(event) => change(id, 'title', event.target.value)}
                        />
                      </td>
                      <td className='p-2'>
                        <Input
                          aria-label={`字段 ${index + 1}`}
                          value={String(column.dataIndex ?? '')}
                          placeholder='例如 name'
                          onChange={(event) => change(id, 'dataIndex', event.target.value)}
                        />
                      </td>
                      <td className='p-2'>
                        <Input
                          type='number'
                          min={1}
                          aria-label={`宽度 ${index + 1}`}
                          value={String(column.width ?? '')}
                          placeholder='自动'
                          onChange={(event) =>
                            change(
                              id,
                              'width',
                              event.target.value === '' ? undefined : Number(event.target.value),
                            )
                          }
                        />
                      </td>
                      <td className='p-2'>
                        <ColumnChoice
                          label={`对齐 ${index + 1}`}
                          value={String(column.align ?? '')}
                          options={[
                            { label: '默认', value: '' },
                            { label: '左对齐', value: 'left' },
                            { label: '居中', value: 'center' },
                            { label: '右对齐', value: 'right' },
                          ]}
                          onChange={(next) => change(id, 'align', next || undefined)}
                        />
                      </td>
                      <td className='p-2'>
                        <ColumnChoice
                          label={`固定 ${index + 1}`}
                          value={String(column.fixed ?? '')}
                          options={[
                            { label: '默认', value: '' },
                            { label: '不固定', value: 'false' },
                            { label: '左侧', value: 'left' },
                            { label: '右侧', value: 'right' },
                            { label: '固定', value: 'true' },
                          ]}
                          onChange={(next) =>
                            change(
                              id,
                              'fixed',
                              next === ''
                                ? undefined
                                : next === 'false'
                                  ? false
                                  : next === 'true'
                                    ? true
                                    : next,
                            )
                          }
                        />
                      </td>
                      <td className='p-2 text-center'>
                        <div className='flex justify-center'>
                          <Checkbox
                            aria-label={`超出省略 ${index + 1}`}
                            checked={Boolean(column.ellipsis)}
                            onCheckedChange={(next) => change(id, 'ellipsis', next === true)}
                          />
                        </div>
                      </td>
                      <td className='p-2'>
                        <div className='flex justify-center gap-0.5'>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon-xs'
                            aria-label={`上移列 ${index + 1}`}
                            title='上移'
                            disabled={index === 0}
                            onClick={() => move(index, -1)}
                          >
                            <ArrowUp className='size-3.5' />
                          </Button>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon-xs'
                            aria-label={`下移列 ${index + 1}`}
                            title='下移'
                            disabled={index === draft.length - 1}
                            onClick={() => move(index, 1)}
                          >
                            <ArrowDown className='size-3.5' />
                          </Button>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon-xs'
                            aria-label={`删除列 ${index + 1}`}
                            title='删除'
                            className='text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                            onClick={() => remove(id)}
                          >
                            <Trash2 className='size-3.5' />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className='p-8 text-center text-muted-foreground'>
                      暂无列，点击下方按钮添加。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => {
                setDraft((previous) => [
                  ...previous,
                  { id: crypto.randomUUID(), column: { title: '', dataIndex: '' } },
                ]);
                setError(undefined);
              }}
            >
              <Plus className='size-3.5' />
              添加列
            </Button>
          </div>
          {error && (
            <p role='alert' className='text-xs text-destructive'>
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => {
                setError(undefined);
                setOpen(false);
              }}
            >
              取消
            </Button>
            <Button type='button' onClick={confirm}>
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
