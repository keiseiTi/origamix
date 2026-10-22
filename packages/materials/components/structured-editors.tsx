import { useState } from 'react';
import {
  Button,
  Checkbox,
  FieldLabel,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@origamix/ui';
import type { CollectionEditorProps } from './collection-editor';
type RecordValue = Record<string, unknown>;
export type StructuredEditorProps = CollectionEditorProps & {
  elementProps?: Readonly<RecordValue>;
  fields?: readonly { name: string; label: string }[];
};
const Choice = ({
  label,
  value,
  options,
  change,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  change: (value: string) => void;
}) => (
  <Select
    items={options}
    value={value}
    onValueChange={(next: string | null) => {
      if (next !== null) change(next);
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
const Flag = ({
  label,
  checked,
  change,
}: {
  label: string;
  checked: boolean;
  change: (next: boolean) => void;
}) => (
  <label className='flex items-center gap-2 text-xs'>
    <Checkbox checked={checked} onCheckedChange={(next) => change(Boolean(next))} />
    {label}
  </label>
);
const isRecord = (value: unknown): value is RecordValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const copy = <T,>(value: T): T => structuredClone(value);

export const PaginationEditor = ({ value, onChange }: StructuredEditorProps) => {
  const [draft, setDraft] = useState<RecordValue | false>(() =>
    isRecord(value) ? copy(value) : false,
  );
  const [error, setError] = useState('');
  const patch = (field: string, next: unknown) => setDraft({ ...draft, [field]: next });
  return (
    <div className='space-y-3'>
      <Flag
        label='开启分页'
        checked={draft !== false}
        change={(enabled) =>
          setDraft(enabled ? { current: 1, pageSize: 10, position: ['bottomRight'] } : false)
        }
      />
      {draft !== false && (
        <>
          {(['pageSize', 'current'] as const).map((field) => (
            <FieldLabel key={field} className='block text-xs'>
              {field === 'pageSize' ? '每页条数' : '初始页码'}
              <Input
                aria-label={field === 'pageSize' ? '每页条数' : '初始页码'}
                type='number'
                min={1}
                step={1}
                value={String(draft[field] ?? (field === 'pageSize' ? 10 : 1))}
                onChange={(event) =>
                  patch(field, event.target.value === '' ? 0 : Number(event.target.value))
                }
              />
            </FieldLabel>
          ))}
          <Choice
            label='分页位置'
            value={String((draft.position as string[])?.[0] ?? 'bottomRight')}
            options={[
              'topLeft',
              'topCenter',
              'topRight',
              'bottomLeft',
              'bottomCenter',
              'bottomRight',
              'none',
            ].map((value, index) => ({
              value,
              label: ['上左', '上中', '上右', '下左', '下中', '下右', '隐藏'][index]!,
            }))}
            change={(next) => patch('position', [next])}
          />
          <Flag
            label='单页隐藏'
            checked={Boolean(draft.hideOnSinglePage)}
            change={(next) => patch('hideOnSinglePage', next)}
          />
          <Flag
            label='简洁分页'
            checked={Boolean(draft.simple)}
            change={(next) => patch('simple', next)}
          />
          {!draft.simple && (
            <>
              <Flag
                label='快速跳页'
                checked={Boolean(draft.showQuickJumper)}
                change={(next) => patch('showQuickJumper', next)}
              />
              <Flag
                label='切换每页条数'
                checked={Boolean(draft.showSizeChanger)}
                change={(next) => patch('showSizeChanger', next)}
              />
            </>
          )}
        </>
      )}
      {error && (
        <p role='alert' className='text-xs text-destructive'>
          {error}
        </p>
      )}
      <div className='flex gap-2'>
        <Button
          size='sm'
          onClick={() => {
            if (
              draft !== false &&
              ['pageSize', 'current'].some(
                (field) => !Number.isInteger(draft[field]) || Number(draft[field]) < 1,
              )
            ) {
              setError('页码和每页条数必须是正整数。');
              return;
            }
            onChange?.(draft);
            setError('');
          }}
        >
          更新分页
        </Button>
        <Button
          size='sm'
          variant='outline'
          onClick={() => {
            setDraft(isRecord(value) ? copy(value) : false);
            setError('');
          }}
        >
          取消修改
        </Button>
      </div>
    </div>
  );
};

const Scalar = ({
  value,
  change,
  label,
  allowStructured = true,
}: {
  value: unknown;
  change: (value: unknown) => void;
  label: string;
  allowStructured?: boolean;
}) => {
  const type =
    value === null
      ? 'null'
      : typeof value === 'object'
        ? Array.isArray(value)
          ? 'array'
          : 'object'
        : typeof value;
  return (
    <div className='space-y-1'>
      <Choice
        label={`${label}类型`}
        value={type}
        options={(allowStructured
          ? ['string', 'number', 'boolean', 'null', 'array', 'object']
          : ['string', 'number', 'boolean', 'null']
        ).map((value, index) => ({
          value,
          label: ['文本', '数字', '布尔值', '空值', '数组', '对象'][index]!,
        }))}
        change={(next) =>
          change(
            next === 'number'
              ? 0
              : next === 'boolean'
                ? false
                : next === 'null'
                  ? null
                  : next === 'array'
                    ? []
                    : next === 'object'
                      ? {}
                      : '',
          )
        }
      />
      {type === 'boolean' ? (
        <Flag label={label} checked={Boolean(value)} change={change} />
      ) : type === 'null' ? null : Array.isArray(value) ? (
        <div className='space-y-2 border-l border-border pl-2'>
          {value.map((item, index) => (
            <div key={index} className='space-y-1'>
              <Scalar
                label={`${label} ${index + 1}`}
                value={item}
                change={(next) => change(value.map((old, i) => (i === index ? next : old)))}
              />
              <Button
                size='sm'
                variant='outline'
                onClick={() => change(value.filter((_, i) => i !== index))}
              >
                移除值 {index + 1}
              </Button>
            </div>
          ))}
          <Button size='sm' variant='outline' onClick={() => change([...value, ''])}>
            添加值
          </Button>
        </div>
      ) : isRecord(value) ? (
        <div className='space-y-2 border-l border-border pl-2'>
          {Object.entries(value).map(([key, item]) => (
            <div key={key}>
              <span className='text-xs'>{key}</span>
              <Scalar
                label={`${label}.${key}`}
                value={item}
                change={(next) => change({ ...value, [key]: next })}
              />
              <Button
                size='sm'
                variant='outline'
                onClick={() => {
                  const next = { ...value };
                  delete next[key];
                  change(next);
                }}
              >
                移除字段 {key}
              </Button>
            </div>
          ))}
          <AddField value={value} change={change} />
        </div>
      ) : (
        <Input
          aria-label={label}
          type={type === 'number' ? 'number' : 'text'}
          value={String(value ?? '')}
          onChange={(event) =>
            change(
              type === 'number'
                ? event.target.value === ''
                  ? NaN
                  : Number(event.target.value)
                : event.target.value,
            )
          }
        />
      )}
    </div>
  );
};
const AddField = ({ value, change }: { value: RecordValue; change: (value: unknown) => void }) => {
  const [name, setName] = useState('');
  return (
    <div className='flex gap-1'>
      <Input aria-label='新字段名' value={name} onChange={(event) => setName(event.target.value)} />
      <Button
        size='sm'
        variant='outline'
        disabled={
          !name.trim() ||
          Object.hasOwn(value, name) ||
          ['__proto__', 'constructor', 'prototype'].includes(name)
        }
        onClick={() => {
          change({ ...value, [name]: '' });
          setName('');
        }}
      >
        添加字段
      </Button>
    </div>
  );
};
const finiteJson = (value: unknown): boolean =>
  typeof value === 'number'
    ? Number.isFinite(value)
    : Array.isArray(value)
      ? value.every(finiteJson)
      : isRecord(value)
        ? Object.entries(value).every(
            ([key, item]) =>
              !['__proto__', 'constructor', 'prototype'].includes(key) && finiteJson(item),
          )
        : true;
export const FormValuesEditor = ({ value, onChange, fields }: StructuredEditorProps) => {
  const [draft, setDraft] = useState<RecordValue>(() => (isRecord(value) ? copy(value) : {}));
  const [error, setError] = useState('');
  return (
    <div className='space-y-2'>
      {fields?.length ? (
        <p className='text-xs text-muted-foreground'>
          已绑定字段：{fields.map((field) => field.label || field.name).join('、')}
        </p>
      ) : (
        <p className='text-xs text-muted-foreground'>请先为子控件配置表单字段名。</p>
      )}
      <Scalar label='初始字段值' value={draft} change={(next) => setDraft(next as RecordValue)} />
      <Button
        size='sm'
        onClick={() => {
          if (!isRecord(draft) || !finiteJson(draft)) {
            setError('初始值必须是有效字段对象。');
            return;
          }
          if (
            fields &&
            Object.keys(draft).some((key) => !fields.some((field) => field.name === key))
          ) {
            setError('初始值中有未绑定的字段，请先为控件配置字段名。');
            return;
          }
          setError('');
          onChange?.(draft);
        }}
      >
        更新初始字段值
      </Button>
      <Button
        size='sm'
        variant='outline'
        onClick={() => setDraft(isRecord(value) ? copy(value) : {})}
      >
        取消修改
      </Button>
      {error && (
        <p role='alert' className='text-xs text-destructive'>
          {error}
        </p>
      )}
    </div>
  );
};
export const TableRowsEditor = ({ value, onChange, elementProps }: StructuredEditorProps) => {
  const [rows, setRows] = useState<RecordValue[]>(() => (Array.isArray(value) ? copy(value) : []));
  const [error, setError] = useState('');
  const columns = (Array.isArray(elementProps?.columns) ? elementProps.columns : []) as {
    title: string;
    dataIndex: string;
  }[];
  return (
    <div className='space-y-2'>
      {rows.map((row, index) => (
        <fieldset key={index} className='min-w-0 space-y-2 rounded border border-border p-2'>
          <legend className='text-xs'>数据行 {index + 1}</legend>
          {[
            ...new Set([
              String(elementProps?.rowKey ?? 'id'),
              ...columns.map((column) => column.dataIndex),
              ...Object.keys(row),
            ]),
          ].map((key) => (
            <div key={key}>
              <FieldLabel className='text-xs'>
                {columns.find((column) => column.dataIndex === key)?.title ?? key}
              </FieldLabel>
              <Scalar
                allowStructured={false}
                label={`行${index + 1} ${key}`}
                value={row[key] ?? ''}
                change={(next) =>
                  setRows(rows.map((old, i) => (i === index ? { ...old, [key]: next } : old)))
                }
              />
            </div>
          ))}
          <Button
            size='sm'
            variant='outline'
            onClick={() => setRows(rows.filter((_, i) => i !== index))}
          >
            删除行 {index + 1}
          </Button>
        </fieldset>
      ))}
      <Button size='sm' variant='outline' onClick={() => setRows([...rows, {}])}>
        添加数据行
      </Button>
      <Button
        size='sm'
        onClick={() => {
          if (
            !finiteJson(rows) ||
            rows.some((row) =>
              Object.values(row).some((cell) => cell !== null && typeof cell === 'object'),
            )
          ) {
            setError('单元格请使用文本、有限数字、布尔值或空值。');
            return;
          }
          setError('');
          onChange?.(rows);
        }}
      >
        更新表格数据
      </Button>
      <Button
        size='sm'
        variant='outline'
        onClick={() => setRows(Array.isArray(value) ? copy(value) : [])}
      >
        取消修改
      </Button>
      {error && (
        <p role='alert' className='text-xs text-destructive'>
          {error}
        </p>
      )}
    </div>
  );
};

type Node = RecordValue & { children?: Node[] };
const nodeIssue = (nodes: Node[], kind: string, seen = new Set<unknown>()): string => {
  for (const node of nodes) {
    const key = kind === 'tree' ? node.key : node.value;
    const title = node[kind === 'cascader' ? 'label' : 'title'];
    if (
      !['string', 'number'].includes(typeof key) ||
      key === '' ||
      typeof title !== 'string' ||
      !title.trim()
    )
      return '请填写节点文本和有效的文本或数字标识。';
    if (seen.has(key)) return '节点标识不能重复。';
    seen.add(key);
    if (node.children) {
      const issue = nodeIssue(node.children, kind, seen);
      if (issue) return issue;
    }
  }
  return '';
};
const Nodes = ({
  nodes,
  change,
  kind,
  prefix = '节点',
}: {
  nodes: Node[];
  change: (next: Node[]) => void;
  kind: string;
  prefix?: string;
}) => (
  <div className='space-y-2'>
    {nodes.map((node, index) => {
      const keyField = kind === 'tree' ? 'key' : 'value';
      const labelField = kind === 'cascader' ? 'label' : 'title';
      const update = (field: string, value: unknown) =>
        change(nodes.map((old, i) => (i === index ? { ...old, [field]: value } : old)));
      return (
        <fieldset key={index} className='min-w-0 space-y-2 rounded border border-border p-2'>
          <legend className='text-xs'>
            {prefix} {index + 1}
          </legend>
          <Input
            aria-label={`${prefix} ${index + 1} 文本`}
            value={String(node[labelField] ?? '')}
            onChange={(event) => update(labelField, event.target.value)}
          />
          <Choice
            label={`${prefix} ${index + 1} 标识类型`}
            value={typeof node[keyField] === 'number' ? 'number' : 'string'}
            options={[
              { value: 'string', label: '文本' },
              { value: 'number', label: '数字' },
            ]}
            change={(next) =>
              update(keyField, next === 'number' ? 0 : String(node[keyField] ?? ''))
            }
          />
          <Input
            aria-label={`${prefix} ${index + 1} 标识`}
            type={typeof node[keyField] === 'number' ? 'number' : 'text'}
            value={String(node[keyField] ?? '')}
            onChange={(event) =>
              update(
                keyField,
                typeof node[keyField] === 'number'
                  ? Number(event.target.value)
                  : event.target.value,
              )
            }
          />
          <Flag
            label={`${prefix} ${index + 1} 禁用`}
            checked={Boolean(node.disabled)}
            change={(next) => update('disabled', next)}
          />
          {kind === 'tree' && (
            <>
              <Flag
                label='允许选择'
                checked={node.selectable !== false}
                change={(next) => update('selectable', next)}
              />
              <Flag
                label='禁用复选框'
                checked={Boolean(node.disableCheckbox)}
                change={(next) => update('disableCheckbox', next)}
              />
            </>
          )}
          <Nodes
            nodes={node.children ?? []}
            kind={kind}
            prefix={`${prefix}${index + 1}子节点`}
            change={(next) => update('children', next)}
          />
          <div className='flex gap-1'>
            <Button
              size='sm'
              variant='outline'
              disabled={index === 0}
              onClick={() => {
                const next = [...nodes];
                [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                change(next);
              }}
            >
              上移节点
            </Button>
            <Button
              size='sm'
              variant='outline'
              disabled={index === nodes.length - 1}
              onClick={() => {
                const next = [...nodes];
                [next[index + 1], next[index]] = [next[index]!, next[index + 1]!];
                change(next);
              }}
            >
              下移节点
            </Button>
            <Button
              size='sm'
              variant='outline'
              onClick={() => change(nodes.filter((_, i) => i !== index))}
            >
              删除节点
            </Button>
          </div>
        </fieldset>
      );
    })}
    <Button
      size='sm'
      variant='outline'
      onClick={() =>
        change([
          ...nodes,
          kind === 'tree'
            ? { title: '', key: '' }
            : kind === 'cascader'
              ? { label: '', value: '' }
              : { title: '', value: '' },
        ])
      }
    >
      添加{prefix}
    </Button>
  </div>
);
const NodeEditor = ({ value, onChange, kind }: { kind: string } & StructuredEditorProps) => {
  const [nodes, setNodes] = useState<Node[]>(() => (Array.isArray(value) ? copy(value) : []));
  const [error, setError] = useState('');
  return (
    <div className='space-y-2'>
      <Nodes nodes={nodes} change={setNodes} kind={kind} />
      {error && (
        <p role='alert' className='text-xs text-destructive'>
          {error}
        </p>
      )}
      <Button
        size='sm'
        onClick={() => {
          const issue = nodeIssue(nodes, kind);
          if (issue) {
            setError(issue);
            return;
          }
          setError('');
          onChange?.(nodes);
        }}
      >
        更新节点数据
      </Button>
      <Button
        size='sm'
        variant='outline'
        onClick={() => {
          setNodes(Array.isArray(value) ? copy(value) : []);
          setError('');
        }}
      >
        取消修改
      </Button>
    </div>
  );
};
export const TreeDataEditor = (props: StructuredEditorProps) => (
  <NodeEditor {...props} kind='tree' />
);
export const TreeSelectDataEditor = (props: StructuredEditorProps) => (
  <NodeEditor {...props} kind='treeSelect' />
);
export const CascaderDataEditor = (props: StructuredEditorProps) => (
  <NodeEditor {...props} kind='cascader' />
);
export const KeysEditor = ({ value, onChange, elementProps }: StructuredEditorProps) => {
  const [keys, setKeys] = useState<unknown[]>(() => (Array.isArray(value) ? copy(value) : []));
  const nodes: Node[] = [];
  const visit = (items: Node[]) =>
    items.forEach((node) => {
      nodes.push(node);
      visit(node.children ?? []);
    });
  visit(Array.isArray(elementProps?.treeData) ? (elementProps.treeData as Node[]) : []);
  return (
    <div className='space-y-2'>
      {!nodes.length && <p className='text-xs text-muted-foreground'>请先配置节点数据。</p>}
      {nodes.map((node) => (
        <Flag
          key={String(node.key)}
          label={String(node.title)}
          checked={keys.includes(node.key)}
          change={(checked) =>
            setKeys(checked ? [...keys, node.key] : keys.filter((key) => key !== node.key))
          }
        />
      ))}
      {keys.some((key) => !nodes.some((node) => node.key === key)) && (
        <p role='alert' className='text-xs text-destructive'>
          已有引用指向移除的节点，请取消修改或重新选择。
        </p>
      )}
      <Button
        size='sm'
        onClick={() => onChange?.(keys.filter((key) => nodes.some((node) => node.key === key)))}
      >
        更新节点选择
      </Button>
      <Button
        size='sm'
        variant='outline'
        onClick={() => setKeys(Array.isArray(value) ? copy(value) : [])}
      >
        取消修改
      </Button>
    </div>
  );
};
export const TabItemsEditor = ({ value, onChange }: StructuredEditorProps) => {
  const [items, setItems] = useState<RecordValue[]>(() =>
    Array.isArray(value) ? copy(value) : [],
  );
  const [error, setError] = useState('');
  const update = (index: number, field: string, next: unknown) =>
    setItems(items.map((item, i) => (i === index ? { ...item, [field]: next } : item)));
  return (
    <div className='space-y-2'>
      {items.map((item, index) => (
        <fieldset key={index} className='space-y-2 rounded border border-border p-2'>
          <legend className='text-xs'>页签 {index + 1}</legend>
          {[
            ['key', '标识'],
            ['label', '名称'],
            ['children', '文本内容'],
          ].map(([field, label]) => (
            <FieldLabel key={field} className='block text-xs'>
              {label}
              <Input
                aria-label={`页签${index + 1}${label}`}
                value={String(item[field!] ?? '')}
                onChange={(event) => update(index, field!, event.target.value)}
              />
            </FieldLabel>
          ))}
          <Flag
            label='禁用页签'
            checked={Boolean(item.disabled)}
            change={(next) => update(index, 'disabled', next)}
          />
          <Flag
            label='允许关闭'
            checked={item.closable !== false}
            change={(next) => update(index, 'closable', next)}
          />
          <Button
            size='sm'
            variant='outline'
            onClick={() => setItems(items.filter((_, i) => i !== index))}
          >
            删除页签
          </Button>
          <Button
            size='sm'
            variant='outline'
            disabled={index === 0}
            onClick={() => {
              const next = [...items];
              [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
              setItems(next);
            }}
          >
            上移页签
          </Button>
        </fieldset>
      ))}
      <Button
        size='sm'
        variant='outline'
        onClick={() => setItems([...items, { key: '', label: '', children: '' }])}
      >
        添加页签
      </Button>
      <Button
        size='sm'
        onClick={() => {
          if (
            items.some(
              (item) =>
                typeof item.key !== 'string' ||
                !item.key ||
                typeof item.label !== 'string' ||
                !item.label.trim(),
            ) ||
            new Set(items.map((item) => item.key)).size !== items.length
          ) {
            setError('页签需要唯一标识和名称。');
            return;
          }
          setError('');
          onChange?.(items);
        }}
      >
        更新页签
      </Button>
      <Button
        size='sm'
        variant='outline'
        onClick={() => setItems(Array.isArray(value) ? copy(value) : [])}
      >
        取消修改
      </Button>
      {error && (
        <p role='alert' className='text-xs text-destructive'>
          {error}
        </p>
      )}
    </div>
  );
};

export const DrawerSizeEditor = ({ value, onChange }: StructuredEditorProps) => {
  const [enabled, setEnabled] = useState(typeof value === 'number');
  const [size, setSize] = useState(typeof value === 'number' ? value : 400);
  const [error, setError] = useState('');
  return (
    <div className='space-y-2'>
      <Flag label='自定义尺寸' checked={enabled} change={setEnabled} />
      {enabled && (
        <FieldLabel className='block text-xs'>
          尺寸（像素）
          <Input
            aria-label='自定义尺寸像素'
            type='number'
            min={1}
            value={String(size)}
            onChange={(event) => setSize(Number(event.target.value))}
          />
        </FieldLabel>
      )}
      {error && (
        <p role='alert' className='text-xs text-destructive'>
          {error}
        </p>
      )}
      <Button
        size='sm'
        onClick={() => {
          if (enabled && (!Number.isFinite(size) || size < 1)) {
            setError('尺寸必须是正数。');
            return;
          }
          setError('');
          onChange?.(enabled ? size : undefined);
        }}
      >
        更新抽屉尺寸
      </Button>
      <Button
        size='sm'
        variant='outline'
        onClick={() => {
          setEnabled(typeof value === 'number');
          setSize(typeof value === 'number' ? value : 400);
          setError('');
        }}
      >
        取消修改
      </Button>
    </div>
  );
};
