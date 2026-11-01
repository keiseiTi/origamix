import { useLiveProperty } from './use-live-property';
import { Choice } from './choice';
import { validateAntdMaterialProps } from '../antd/validation';
import { useState } from 'react';
import {
  Button,
  Checkbox,
  FieldLabel,
  Input,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@origamix/ui';
import type { CollectionEditorProps } from './collection-editor';
type RecordValue = Record<string, unknown>;
export type StructuredEditorProps = CollectionEditorProps & {
  elementProps?: Readonly<RecordValue>;
  fields?: readonly { name: string; label: string }[];
};
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
  const [pending, setPending] = useState<{
    base: unknown;
    draft: RecordValue | false;
    error: string;
  }>();
  const draft = pending && pending.base === value ? pending.draft : isRecord(value) ? value : false;
  const error = pending && pending.base === value ? pending.error : '';
  const commit = (next: RecordValue | false) => {
    const issue =
      next !== false &&
      (['pageSize', 'current'] as const).some((field) => {
        const number = next[field] ?? (field === 'pageSize' ? 10 : 1);
        return !Number.isInteger(number) || Number(number) < 1;
      })
        ? '页码和每页条数必须是正整数。'
        : '';
    setPending({ base: value, draft: next, error: issue });
    if (!issue) onChange?.(next);
  };
  const patch = (field: string, next: unknown) => commit({ ...draft, [field]: next });
  return (
    <div className='space-y-3'>
      <Flag
        label='开启分页'
        checked={draft !== false}
        change={(enabled) =>
          commit(enabled ? { current: 1, pageSize: 10, position: ['bottomRight'] } : false)
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
                  patch(field, event.target.value === '' ? '' : Number(event.target.value))
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
            onChange={(next) => patch('position', [next])}
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
    </div>
  );
};

type Node = RecordValue & { children?: Node[] };
const nodeIssue = (nodes: Node[], kind: string): string => {
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
    if (node.children) {
      const issue = nodeIssue(node.children, kind);
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
            onChange={(next) =>
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
  const [open, setOpen] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setNodes(Array.isArray(value) ? copy(value) : []);
        setError('');
        setOpen(next);
      }}
    >
      <p className='text-xs text-muted-foreground'>
        已配置 {Array.isArray(value) ? value.length : 0} 个根节点
      </p>
      <DialogTrigger render={<Button size='sm' variant='outline' disabled={!onChange} />}>
        配置节点
      </DialogTrigger>
      <DialogContent className='flex max-h-[85dvh] flex-col sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>配置树节点</DialogTitle>
          <DialogDescription>编辑节点层级、文本和标识，确认后生效。</DialogDescription>
        </DialogHeader>
        <div className='min-h-0 overflow-auto'>
          <Nodes nodes={nodes} change={setNodes} kind={kind} />
        </div>
        {error && (
          <p role='alert' className='text-xs text-destructive'>
            {error}
          </p>
        )}
        <DialogFooter>
          <Button size='sm' variant='outline' onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            size='sm'
            onClick={() => {
              const type =
                kind === 'tree' ? 'tree' : kind === 'cascader' ? 'cascader' : 'treeSelect';
              const field = kind === 'cascader' ? 'options' : 'treeData';
              const issue =
                nodeIssue(nodes, kind) ||
                validateAntdMaterialProps(type, { [field]: nodes })[0]?.message;
              if (issue) {
                setError(issue);
                return;
              }
              onChange?.(nodes);
              setOpen(false);
            }}
          >
            确定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const keys: unknown[] = Array.isArray(value) ? value : [];
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
            onChange?.(
              (checked ? [...keys, node.key] : keys.filter((key) => key !== node.key)).filter(
                (key) => nodes.some((node) => node.key === key),
              ),
            )
          }
        />
      ))}
      {keys.some((key) => !nodes.some((node) => node.key === key)) && (
        <p role='alert' className='text-xs text-destructive'>
          已有引用指向移除的节点，请重新选择。
        </p>
      )}
    </div>
  );
};
export const TabItemsEditor = ({ value, onChange }: StructuredEditorProps) => {
  const {
    draft: items,
    change: setItems,
    error,
  } = useLiveProperty<RecordValue[]>(
    value,
    (value) => (Array.isArray(value) ? copy(value) : []),
    (items) =>
      items.some(
        (item) =>
          typeof item.key !== 'string' ||
          !item.key ||
          typeof item.label !== 'string' ||
          !item.label.trim(),
      ) || validateAntdMaterialProps('tabs', { items }).length > 0
        ? '页签需要唯一标识和名称。'
        : undefined,
    onChange,
  );
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
      {error && (
        <p role='alert' className='text-xs text-destructive'>
          {error}
        </p>
      )}
    </div>
  );
};
