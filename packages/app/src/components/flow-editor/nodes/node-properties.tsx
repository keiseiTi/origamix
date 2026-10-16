import { getElementLabel } from '@origamix/shared/protocol/schema';
import type LogicFlow from '@logicflow/core';
import { useEditorCore } from '@tangramino/base-editor';
import { Checkbox } from '@/components/ui/checkbox';
import { FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FlowSelect } from '../flow-select';
import { getNodeDefinition } from './definitions';
import { SettersFields } from './setters-fields';
import { ValueField } from './value-field';

export const NodeProperties = ({
  node,
  onChange,
  eventLabel,
}: {
  node: LogicFlow.NodeData;
  onChange: (patch: Record<string, unknown>) => void;
  eventLabel?: string;
}): React.JSX.Element => {
  const schema = useEditorCore((state) => state.schema);
  const materials = useEditorCore((state) => state.materials);
  const properties = node.properties ?? {};
  const type = node.type;
  const elementOptions = Object.entries(schema.elements).map(([id, item]) => ({
    value: id,
    label: getElementLabel(
      id,
      item,
      String(materials.find((material) => material.type === item.type)?.title ?? item.type),
    ),
  }));
  const portalOptions = elementOptions.filter((item) =>
    ['modal', 'drawer'].includes(schema.elements[item.value]?.type ?? ''),
  );
  const ids = Array.isArray(properties.elementIds)
    ? properties.elementIds
    : properties.elementId
      ? [properties.elementId]
      : [];
  return (
    <div className='space-y-3'>
      <div className='space-y-1.5'>
        <FieldLabel htmlFor={`node-title-${node.id}`}>节点别名</FieldLabel>
        <Input
          id={`node-title-${node.id}`}
          value={String(properties.title ?? properties.alias ?? '')}
          placeholder={getNodeDefinition(String(type))?.title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </div>
      <p className='break-all text-[11px] text-muted-foreground'>
        类型：{type} · ID：{node.id}
      </p>
      {type === 'start' && (
        <p className='text-xs text-muted-foreground'>
          {eventLabel ?? '事件'}触发后，从此节点开始执行。开始节点不可删除。
        </p>
      )}
      {['setElementProps', 'setGlobalVariable', 'emitElementAction'].includes(String(type)) && (
        <SettersFields
          key={node.id}
          type={String(type)}
          properties={properties}
          onChange={onChange}
        />
      )}
      {type === 'visibleElement' && (
        <>
          <FieldLabel>目标组件（可多选）</FieldLabel>
          <div className='max-h-48 space-y-2 overflow-auto rounded-md border border-border p-2'>
            {elementOptions.map((option) => (
              <label key={option.value} className='flex items-center gap-2 text-xs'>
                <Checkbox
                  checked={ids.includes(option.value)}
                  onCheckedChange={(checked) =>
                    onChange({
                      elementIds: checked
                        ? [...ids, option.value]
                        : ids.filter((id) => id !== option.value),
                    })
                  }
                />
                <span className='truncate'>{option.label}</span>
              </label>
            ))}
          </div>
          <ValueField
            label='显隐设置'
            value={properties.value ?? properties.visible ?? true}
            onChange={(value) => onChange({ value })}
          />
          <p className='text-xs text-muted-foreground'>
            true 显示，false 隐藏；可绑定全局变量或前序节点返回值。
          </p>
        </>
      )}
      {(type === 'openModalDrawer' || type === 'closeModalDrawer') && (
        <>
          <FieldLabel>弹窗 / 抽屉</FieldLabel>
          <FlowSelect
            label='弹窗或抽屉'
            value={String(properties.elementId ?? '')}
            options={portalOptions}
            onChange={(elementId) => onChange({ elementId })}
          />
          {portalOptions.length === 0 && (
            <p className='text-xs text-muted-foreground'>请先在视图中添加弹窗或抽屉组件。</p>
          )}
        </>
      )}
      {type === 'interfaceRequest' && (
        <>
          <div className='space-y-1.5'>
            <FieldLabel htmlFor={`url-${node.id}`}>请求 URL</FieldLabel>
            <Input
              id={`url-${node.id}`}
              placeholder='https://api.example.com/data'
              value={String(properties.url ?? '')}
              onChange={(event) => onChange({ url: event.target.value })}
            />
          </div>
          <FieldLabel>请求方法</FieldLabel>
          <FlowSelect
            label='请求方法'
            value={String(properties.method ?? 'get')}
            options={['get', 'post', 'delete', 'put', 'patch'].map((method) => ({
              value: method,
              label: method.toUpperCase(),
            }))}
            onChange={(method) => onChange({ method })}
          />
          <ValueField
            label='请求头参数'
            objectOnly
            value={properties.headers ?? {}}
            onChange={(headers) => onChange({ headers })}
          />
          <ValueField
            label='查询参数'
            objectOnly
            value={properties.queryParams ?? {}}
            onChange={(queryParams) => onChange({ queryParams })}
          />
          <ValueField
            label='请求体参数'
            value={properties.bodyParams}
            onChange={(bodyParams) => onChange({ bodyParams })}
          />
          <div className='space-y-1.5'>
            <FieldLabel htmlFor={`timeout-${node.id}`}>超时时间（毫秒）</FieldLabel>
            <Input
              id={`timeout-${node.id}`}
              type='number'
              min={100}
              max={60000}
              value={Number(properties.timeout ?? 10000)}
              onChange={(event) =>
                onChange({
                  timeout: Math.max(100, Math.min(60000, Number(event.target.value) || 10000)),
                })
              }
            />
          </div>
          <p className='text-xs text-muted-foreground'>
            返回值包含 ok、status、data 和 error，后续节点可通过节点 ID 引用。请求不携带工作台凭据。
          </p>
        </>
      )}
      {type === 'customJS' && (
        <>
          <FieldLabel htmlFor={`code-${node.id}`}>自定义代码</FieldLabel>
          <Textarea
            id={`code-${node.id}`}
            className='min-h-52 font-mono text-xs'
            value={String(properties.code ?? properties.value ?? '')}
            onChange={(event) => onChange({ code: event.target.value })}
            spellCheck={false}
          />
          <p
            role='status'
            className='rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground'
          >
            仅保存代码配置，当前暂不执行自定义 JS。
          </p>
        </>
      )}
      {type === 'condition' && (
        <>
          <ValueField
            label='判断值'
            value={properties.judgment ?? true}
            onChange={(judgment) => onChange({ judgment })}
          />
          <FieldLabel>比较方式</FieldLabel>
          <FlowSelect
            label='比较方式'
            value={String(properties.operator ?? 'truthy')}
            options={[
              ['truthy', '是否为真'],
              ['equals', '等于'],
              ['notEquals', '不等于'],
              ['greater', '大于'],
              ['less', '小于'],
            ].map(([value, label]) => ({ value: value!, label: label! }))}
            onChange={(operator) => onChange({ operator })}
          />
          {properties.operator && properties.operator !== 'truthy' && (
            <ValueField
              label='比较值'
              value={properties.compareValue}
              onChange={(compareValue) => onChange({ compareValue })}
            />
          )}
          <p className='text-xs text-muted-foreground'>
            右上锚点为“真”，右下锚点为“假”。拖动锚点连接对应分支，每个分支只能连接一个节点。
          </p>
        </>
      )}
      {!getNodeDefinition(String(type)) && (
        <p role='alert' className='text-xs text-danger'>
          当前节点类型不受支持，请检查 Schema 配置。
        </p>
      )}
    </div>
  );
};
