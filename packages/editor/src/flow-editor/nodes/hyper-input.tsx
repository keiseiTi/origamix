import { useState } from 'react';
import {
  getElementLabel,
  getFlowNodeManifest,
  type HyperValue,
  type FunctionValue,
} from '@origamix/shared';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  FieldLabel,
  Input,
  Textarea,
} from '@origamix/ui';
import { Plus, Trash2 } from 'lucide-react';
import { CodeEditor } from '../../components/code-editor';
import { useFlowEditorSession } from '../session';
import { FlowSelect } from '../flow-select';
import { asRecord } from './values';

const types = [
  ['string', '字符串'],
  ['number', '数字'],
  ['boolean', '布尔值'],
  ['null', '空值'],
  ['contextValue', '上下文'],
  ['expression', '表达式'],
  ['function', '函数'],
] as const;
const initial = (type: HyperValue['type']): HyperValue => {
  switch (type) {
    case 'string':
    case 'contextValue':
    case 'expression':
      return { type, value: '' };
    case 'number':
      return { type, value: 0 };
    case 'boolean':
      return { type, value: true };
    case 'null':
      return { type, value: null };
    case 'function':
      return { type, value: { params: [], body: '' } };
  }
};

export const HyperInput = ({
  label,
  value,
  onChange,
  showTypes,
}: {
  label: string;
  value: unknown;
  onChange: (value: HyperValue) => void;
  showTypes?: readonly HyperValue['type'][];
}): React.JSX.Element => {
  const { schema, materials, catalog } = useFlowEditorSession();
  const data = asRecord(value);
  const type = String(data.type ?? showTypes?.[0] ?? 'string') as HyperValue['type'];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FunctionValue['value']>({ params: [], body: '' });
  const [error, setError] = useState<string | null>(null);
  const options = Object.entries(schema.elements)
    .flatMap(([id, element]) => {
      const material = materials.find((item) => item.type === element.type);
      const title = getElementLabel(id, element, String(material?.title ?? element.type));
      const manifest = catalog.find((item) => item.type === element.type);
      const names = new Set([
        ...Object.keys(manifest?.propsSchema.properties ?? {}),
        ...(material?.contextConfig?.variables ?? []).map((item) => item.name),
      ]);
      return [
        ...[...names].map((name) => ({
          value: `state.${id}.${name}`,
          label: `${title} · ${name}`,
        })),
        ...(material?.contextConfig?.contextValues ?? [])
          .filter((item) => item.isMethod)
          .map((item) => ({
            value: `method.${id}.${item.name}`,
            label: `${title} · 方法 ${item.description || item.name}`,
          })),
      ];
    })
    .concat(
      (schema.context?.globalVariables ?? []).map((item) => ({
        value: `global.${item.name}`,
        label: `全局变量 · ${item.name}`,
      })),
      Object.values(schema.flows ?? {}).flatMap((flow) =>
        Object.values(flow.nodes)
          .filter((node) => node.type !== 'start')
          .map((node) => ({
            value: `result.${node.id}`,
            label: `节点结果 · ${String(node.props.title || getFlowNodeManifest(node.type)?.title || '流程节点')}`,
          })),
      ),
    );
  const patchParam = (
    index: number,
    patch: Partial<FunctionValue['value']['params'][number]>,
  ): void =>
    setDraft((current) => ({
      ...current,
      params: current.params.map((param, i) => (i === index ? { ...param, ...patch } : param)),
    }));
  return (
    <div className='space-y-2'>
      <FieldLabel>{label}</FieldLabel>
      {showTypes?.length !== 1 && (
        <FlowSelect
          label={`${label}类型`}
          value={type}
          options={types
            .filter(([key]) => !showTypes || showTypes.includes(key))
            .map(([value, label]) => ({ value, label }))}
          onChange={(next) => onChange(initial(next as HyperValue['type']))}
        />
      )}
      {type === 'string' && (
        <Input
          aria-label={label}
          value={String(data.value ?? '')}
          onChange={(event) => onChange({ type, value: event.target.value })}
        />
      )}
      {type === 'number' && (
        <Input
          aria-label={label}
          type='number'
          value={Number(data.value ?? 0)}
          onChange={(event) => {
            const number = event.target.valueAsNumber;
            if (Number.isFinite(number)) onChange({ type, value: number });
          }}
        />
      )}
      {type === 'boolean' && (
        <FlowSelect
          label={label}
          value={String(data.value)}
          options={[
            { value: 'true', label: '是' },
            { value: 'false', label: '否' },
          ]}
          onChange={(value) => onChange({ type, value: value === 'true' })}
        />
      )}
      {type === 'null' && <p className='text-xs text-muted-foreground'>null</p>}
      {type === 'contextValue' && (
        <>
          <FlowSelect
            label={`${label}上下文`}
            value={String(data.value ?? '')}
            options={options.filter((item) => !item.value.startsWith('method.'))}
            onChange={(value) => onChange({ type, value })}
          />
          <Input
            aria-label={`${label}上下文路径`}
            placeholder='state.元素ID.属性 / global.变量 / result.节点ID.data'
            value={String(data.value ?? '')}
            onChange={(event) => onChange({ type, value: event.target.value })}
          />
        </>
      )}
      {type === 'expression' && (
        <Textarea
          aria-label={`${label}表达式`}
          className='min-h-24 font-mono text-xs'
          value={String(data.value ?? '')}
          onChange={(event) => onChange({ type, value: event.target.value })}
          placeholder='例如：({ page: 1, size: 20 })'
        />
      )}
      {type === 'function' && (
        <Button
          size='sm'
          variant='outline'
          onClick={() => {
            const value = asRecord(data.value);
            setDraft({
              params: Array.isArray(value.params) ? structuredClone(value.params) : [],
              body: String(value.body ?? ''),
            });
            setError(null);
            setOpen(true);
          }}
        >
          编辑{label}函数
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='flex h-[min(85dvh,760px)] w-[calc(100%-2rem)] max-w-4xl flex-col overflow-hidden sm:max-w-4xl'>
          <DialogHeader>
            <DialogTitle>{label} · 函数配置</DialogTitle>
          </DialogHeader>
          <div className='max-h-52 shrink-0 space-y-2 overflow-auto'>
            {draft.params.map((param, index) => (
              <div key={index} className='grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-2'>
                <Input
                  aria-label={`参数 ${index + 1} 名称`}
                  placeholder='参数名'
                  value={param.name}
                  onChange={(event) => patchParam(index, { name: event.target.value })}
                />
                <div className='space-y-1'>
                  <FlowSelect
                    label={`参数 ${index + 1} 来源`}
                    value={param.value}
                    options={options}
                    onChange={(value) => patchParam(index, { value })}
                  />
                  <Input
                    aria-label={`参数 ${index + 1} 路径`}
                    placeholder='上下文路径'
                    value={param.value}
                    onChange={(event) => patchParam(index, { value: event.target.value })}
                  />
                </div>
                <Button
                  variant='ghost'
                  size='icon-sm'
                  aria-label={`删除参数 ${index + 1}`}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      params: current.params.filter((_, i) => i !== index),
                    }))
                  }
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
            <Button
              variant='outline'
              size='sm'
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  params: [...current.params, { name: '', value: '' }],
                }))
              }
            >
              <Plus size={14} />
              添加参数
            </Button>
          </div>
          <p className='text-xs text-muted-foreground'>
            参数从页面上下文读取；使用 return 返回值。代码只在页面运行时执行。
          </p>
          <CodeEditor
            ariaLabel={`${label}函数体`}
            className='min-h-48 flex-1'
            language='javascript'
            value={draft.body}
            onChange={(body) => setDraft((current) => ({ ...current, body }))}
          />
          {error && (
            <p role='alert' className='text-xs text-destructive'>
              {error}
            </p>
          )}
          <div className='flex justify-end gap-2'>
            <Button variant='outline' onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                const names = draft.params.map((param) => param.name);
                if (
                  names.some((name) => !/^[A-Za-z_$][\w$]*$/.test(name)) ||
                  new Set(names).size !== names.length ||
                  draft.params.some(
                    (param) => !/^(state|global|result|method)\..+/.test(param.value),
                  )
                ) {
                  setError('请填写唯一的有效参数名和上下文来源');
                  return;
                }
                onChange({ type: 'function', value: draft });
                setOpen(false);
              }}
            >
              确认函数
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
