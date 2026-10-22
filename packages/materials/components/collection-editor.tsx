import { useState } from 'react';
import {
  Button,
  Checkbox,
  Input,
  FieldLabel,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@origamix/ui';
import { validateColumns } from '../antd/structured-data-validation';

type Row = Record<string, unknown>;
export interface CollectionEditorProps {
  value?: unknown;
  onChange?: (value: unknown) => void;
}

const Choice = ({
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
    onValueChange={(next: string | null) => {
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

const validateOptions = (rows: Row[]): string | undefined => {
  const keys = new Set<unknown>();
  for (const row of rows) {
    if (
      typeof row.label !== 'string' ||
      !row.label.trim() ||
      !['string', 'number', 'boolean'].includes(typeof row.value) ||
      row.value === '' ||
      (typeof row.value === 'number' && !Number.isFinite(row.value))
    )
      return '请填写选项名称和有效的值。';
    if (keys.has(row.value)) return '选项值不能重复。';
    keys.add(row.value);
  }
  return undefined;
};

const CollectionEditor = ({
  value,
  onChange,
  columns = false,
  allowBoolean = true,
}: CollectionEditorProps & { columns?: boolean; allowBoolean?: boolean }) => {
  const [rows, setRows] = useState<Row[]>(() =>
    Array.isArray(value)
      ? value.map((item) =>
          typeof item === 'object' && item !== null
            ? { ...item }
            : { label: String(item), value: item },
        )
      : [],
  );
  const [error, setError] = useState<string>();
  const title = columns ? '列配置' : '选项配置';
  const change = (index: number, field: string, next: unknown): void => {
    setRows(
      rows.map((row, i) => {
        if (i !== index) return row;
        const result = { ...row, [field]: next };
        if (next === undefined) delete result[field];
        return result;
      }),
    );
    setError(undefined);
  };
  const move = (index: number, offset: number): void => {
    const next = [...rows];
    [next[index], next[index + offset]] = [next[index + offset]!, next[index]!];
    setRows(next);
  };
  return (
    <div className='space-y-3'>
      {!rows.length && (
        <p className='text-xs text-muted-foreground'>暂无{columns ? '列' : '选项'}，请添加。</p>
      )}
      {rows.map((row, index) => (
        <fieldset key={index} className='min-w-0 space-y-2 rounded border border-border p-2'>
          <legend className='px-1 text-xs'>
            {columns ? '列' : '选项'} {index + 1}
          </legend>
          {(columns
            ? [
                ['title', '列名'],
                ['dataIndex', '字段'],
                ['key', '唯一标识（可选）'],
              ]
            : [['label', '名称']]
          ).map(([field, label]) => (
            <FieldLabel key={field} className='block text-xs'>
              {label}
              <Input
                aria-label={`${label} ${index + 1}`}
                value={String(row[field!] ?? '')}
                onChange={(event) =>
                  change(index, field!, event.target.value || (field === 'key' ? undefined : ''))
                }
              />
            </FieldLabel>
          ))}
          {!columns && (
            <>
              <FieldLabel className='block text-xs'>
                值类型
                <Choice
                  label={`值类型 ${index + 1}`}
                  value={typeof row.value}
                  options={[
                    { label: '文本', value: 'string' },
                    { label: '数字', value: 'number' },
                    ...(allowBoolean ? [{ label: '布尔值', value: 'boolean' }] : []),
                  ]}
                  onChange={(next) =>
                    change(
                      index,
                      'value',
                      next === 'number' ? 0 : next === 'boolean' ? false : String(row.value ?? ''),
                    )
                  }
                />
              </FieldLabel>
              {typeof row.value === 'boolean' ? (
                <label className='flex items-center gap-2 text-xs'>
                  <Checkbox
                    checked={row.value}
                    onCheckedChange={(next) => change(index, 'value', next)}
                  />
                  值为 true
                </label>
              ) : (
                <FieldLabel className='block text-xs'>
                  值
                  <Input
                    aria-label={`值 ${index + 1}`}
                    type={typeof row.value === 'number' ? 'number' : 'text'}
                    value={String(row.value ?? '')}
                    onChange={(event) =>
                      change(
                        index,
                        'value',
                        typeof row.value === 'number'
                          ? event.target.value === ''
                            ? NaN
                            : Number(event.target.value)
                          : event.target.value,
                      )
                    }
                  />
                </FieldLabel>
              )}
            </>
          )}
          {columns && (
            <>
              <FieldLabel className='block text-xs'>
                宽度
                <Input
                  aria-label={`宽度 ${index + 1}`}
                  type='number'
                  min={1}
                  value={String(row.width ?? '')}
                  onChange={(event) =>
                    change(
                      index,
                      'width',
                      event.target.value === '' ? undefined : Number(event.target.value),
                    )
                  }
                />
              </FieldLabel>
              {(['align', 'fixed'] as const).map((field) => (
                <FieldLabel key={field} className='block text-xs'>
                  {field === 'align' ? '对齐' : '固定'}
                  <Choice
                    label={`${field === 'align' ? '对齐' : '固定'} ${index + 1}`}
                    value={String(row[field] ?? '')}
                    options={[
                      { label: '默认', value: '' },
                      { label: '左侧', value: 'left' },
                      ...(field === 'align' ? [{ label: '居中', value: 'center' }] : []),
                      { label: '右侧', value: 'right' },
                      ...(field === 'fixed'
                        ? [
                            { label: '不固定', value: 'false' },
                            { label: '固定左侧', value: 'true' },
                          ]
                        : []),
                    ]}
                    onChange={(next) =>
                      change(
                        index,
                        field,
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
                </FieldLabel>
              ))}
            </>
          )}
          {(columns
            ? [
                ['ellipsis', '超出省略'],
                ['hidden', '隐藏列'],
              ]
            : []
          ).map(([field, label]) => (
            <label key={field} className='flex items-center gap-2 text-xs'>
              <Checkbox
                checked={Boolean(row[field!])}
                onCheckedChange={(next) => change(index, field!, next)}
              />
              {label}
            </label>
          ))}
          <div className='flex gap-1'>
            <Button
              size='sm'
              variant='outline'
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              上移
            </Button>
            <Button
              size='sm'
              variant='outline'
              disabled={index === rows.length - 1}
              onClick={() => move(index, 1)}
            >
              下移
            </Button>
            <Button
              size='sm'
              variant='outline'
              onClick={() => setRows(rows.filter((_, i) => i !== index))}
            >
              删除
            </Button>
          </div>
        </fieldset>
      ))}
      <Button
        size='sm'
        variant='outline'
        onClick={() =>
          setRows([...rows, columns ? { title: '', dataIndex: '' } : { label: '', value: '' }])
        }
      >
        添加{columns ? '列' : '选项'}
      </Button>
      {error && (
        <p role='alert' className='text-xs text-destructive'>
          {error}
        </p>
      )}
      <Button
        size='sm'
        onClick={() => {
          const issue = columns
            ? validateColumns(rows)
            : !allowBoolean && rows.some((row) => typeof row.value === 'boolean')
              ? '下拉选项值请使用文本或数字。'
              : validateOptions(rows);
          if (issue) {
            setError(issue);
            return;
          }
          setError(undefined);
          onChange?.(rows);
        }}
      >
        更新{title}
      </Button>
      <p className='text-xs text-muted-foreground'>编辑后点击更新，再保存版本。</p>
    </div>
  );
};

export const OptionsEditor = (props: CollectionEditorProps) => <CollectionEditor {...props} />;
export const ColumnsEditor = (props: CollectionEditorProps) => (
  <CollectionEditor {...props} columns />
);

export const SelectOptionsEditor = (props: CollectionEditorProps) => (
  <CollectionEditor {...props} allowBoolean={false} />
);
