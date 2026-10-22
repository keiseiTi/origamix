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
import { ContextSourceSelect, type ContextSourceOption } from './context-source-select';

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
  const [draft, setDraft] = useState<FunctionValue['value']>({
    params: [{ name: '', value: '' }],
    body: '',
  });
  const [error, setError] = useState<string | null>(null);
  const options: ContextSourceOption[] = Object.entries(schema.elements)
    .flatMap(([id, element]) => {
      const material = materials.find((item) => item.type === element.type);
      const title = getElementLabel(id, element, String(material?.title ?? element.type));
      const manifest = catalog.find((item) => item.type === element.type);
      const alias = typeof element.props?.alias === 'string' ? element.props.alias.trim() : '';
      const elementTags = [
        ...(alias ? [alias] : []),
        String(material?.title ?? element.type),
        '元素',
      ];
      const fieldLabels = new Map(
        (material?.editorConfig?.panels ?? []).flatMap((panel) =>
          (panel.configs ?? []).map((field) => [field.field, field.label] as const),
        ),
      );
      const names = new Set([...(manifest?.context.variables ?? []).map((item) => item.name)]);
      return [
        ...[...names].map((name) => ({
          value: `state.${id}.${name}`,
          name,
          label: `${title} · ${String(fieldLabels.get(name) || material?.contextConfig?.variables?.find((field) => field.name === name)?.description || name)}（${name}）`,
          property: String(
            fieldLabels.get(name) ||
              material?.contextConfig?.variables?.find((field) => field.name === name)
                ?.description ||
              name,
          ),
          tags: elementTags,
        })),
        ...(material?.contextConfig?.contextValues ?? [])
          .filter((item) => item.isMethod)
          .map((item) => ({
            value: `method.${id}.${item.name}`,
            name: item.name,
            label: `${title} · 方法 ${item.description || item.name}`,
            property: item.description || item.name,
            tags: elementTags,
          })),
      ];
    })
    .concat(
      [
        {
          value: 'event.payload',
          name: 'payload',
          label: '当前事件 · 业务参数',
          property: '业务参数',
          tags: ['事件'],
        },
      ],
      (schema.context?.globalVariables ?? []).map((item) => ({
        value: `global.${item.name}`,
        name: item.name,
        label: `全局变量 · ${item.name}`,
        property: item.name,
        tags: ['全局变量'],
      })),
      Object.values(schema.flows ?? {}).flatMap((flow) =>
        Object.values(flow.nodes)
          .filter((node) => node.type !== 'start')
          .map((node) => ({
            value: `result.${node.id}`,
            name: 'result',
            label: `节点结果 · ${String(node.props.title || getFlowNodeManifest(node.type)?.title || '流程节点')}`,
            property: '返回结果',
            tags: [
              ...(typeof node.props.title === 'string' && node.props.title.trim()
                ? [node.props.title]
                : []),
              getFlowNodeManifest(node.type)?.title || '流程节点',
              node.type === 'interfaceRequest' ? '接口' : '节点',
            ],
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
            placeholder='state.元素ID.业务属性 / event.payload / global.变量 / result.节点ID.data'
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
              params:
                Array.isArray(value.params) && value.params.length
                  ? structuredClone(value.params)
                  : [{ name: '', value: '' }],
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
          <div className='max-h-64 shrink-0 space-y-2 overflow-auto'>
            {draft.params.map((param, index) => (
              <div
                key={index}
                className='grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,160px)_auto]'
              >
                <div className='col-span-2 min-w-0 sm:col-span-1'>
                  <ContextSourceSelect
                    label={`参数 ${index + 1} 来源`}
                    value={param.value}
                    options={options}
                    onChange={(value) => {
                      const option = options.find((option) => option.value === value);
                      patchParam(index, { value, ...(option ? { name: option.name } : {}) });
                    }}
                  />
                </div>
                <Input
                  aria-label={`参数 ${index + 1} 名称`}
                  placeholder='参数名（可修改）'
                  value={param.name}
                  onChange={(event) => patchParam(index, { name: event.target.value })}
                />
                <div className='flex items-center gap-1'>
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    aria-label={`在参数 ${index + 1} 后添加参数`}
                    title='添加参数'
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        params: [
                          ...current.params.slice(0, index + 1),
                          { name: '', value: '' },
                          ...current.params.slice(index + 1),
                        ],
                      }))
                    }
                  >
                    <Plus size={14} />
                  </Button>
                  {draft.params.length > 1 && (
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
                  )}
                </div>
              </div>
            ))}
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
                const params = draft.params.filter(
                  (param) => param.name.trim() || param.value.trim(),
                );
                const names = params.map((param) => param.name);
                if (
                  names.some((name) => !/^[A-Za-z_$][\w$]*$/.test(name)) ||
                  new Set(names).size !== names.length ||
                  params.some((param) => !/^(state|global|result|method)\..+/.test(param.value))
                ) {
                  setError('请填写唯一的有效参数名和上下文来源');
                  return;
                }
                onChange({ type: 'function', value: { ...draft, params } });
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
