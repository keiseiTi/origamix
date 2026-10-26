import { getElementLabel } from '@origamix/shared';
import type LogicFlow from '@logicflow/core';
import { useFlowEditorSession } from '../flow-editor-context';
import { Checkbox, FieldLabel, Input } from '@origamix/ui';

import { FlowSelect } from '../flow-select';
import { getNodeDefinition, getNodePropertyChoices } from './node-catalog';
import { SettersFields } from './setter-fields';
import { HyperInput } from './hyper-value-input';

export const NodeProperties = ({
  node,
  onChange,
  eventLabel,
}: {
  node: LogicFlow.NodeData;
  onChange: (patch: Record<string, unknown>) => void;
  eventLabel?: string;
}): React.JSX.Element => {
  const { schema, materials } = useFlowEditorSession();
  const properties = node.properties ?? {};
  const type = node.type;
  const definition = getNodeDefinition(String(type));
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
  const ids = Array.isArray(properties.elementIds) ? properties.elementIds : [];
  return (
    <div className='space-y-3'>
      <div className='space-y-1.5'>
        <FieldLabel htmlFor={`node-title-${node.id}`}>节点别名</FieldLabel>
        <Input
          id={`node-title-${node.id}`}
          value={String(properties.title ?? '')}
          placeholder={getNodeDefinition(String(type))?.title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </div>
      {definition && <p className='text-xs text-muted-foreground'>{definition.description}</p>}
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
          <HyperInput
            label='显隐设置'
            showTypes={['boolean', 'expression', 'function']}
            value={properties.value ?? true}
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
          <HyperInput
            label='请求 URL'
            showTypes={['string', 'expression', 'function']}
            value={properties.url ?? ''}
            onChange={(url) => onChange({ url })}
          />
          <FieldLabel>请求方法</FieldLabel>
          <FlowSelect
            label='请求方法'
            value={String(properties.method ?? 'get')}
            options={getNodePropertyChoices('interfaceRequest', 'method').map((method) => ({
              value: method,
              label: method.toUpperCase(),
            }))}
            onChange={(method) => onChange({ method })}
          />
          <HyperInput
            label='请求头参数'
            showTypes={['function']}
            value={properties.headers ?? {}}
            onChange={(headers) => onChange({ headers })}
          />
          <HyperInput
            label='查询参数'
            showTypes={['function']}
            value={properties.queryParams ?? {}}
            onChange={(queryParams) => onChange({ queryParams })}
          />
          <HyperInput
            label='请求体参数'
            showTypes={['function']}
            value={properties.bodyParams}
            onChange={(bodyParams) => onChange({ bodyParams })}
          />
          <p className='text-xs text-muted-foreground'>
            返回值包含 ok、status、data 和
            error，后续节点可通过上下文选择节点结果。请求不携带工作台凭据。
          </p>
        </>
      )}
      {type === 'customJS' && (
        <HyperInput
          label='自定义 JS'
          showTypes={['function']}
          value={properties.value}
          onChange={(value) => onChange({ value })}
        />
      )}
      {definition?.executable === false && (
        <p
          role='status'
          className='rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground'
        >
          当前节点仅保存配置，不参与执行。
        </p>
      )}
      {type === 'condition' && (
        <>
          <HyperInput
            label='条件判断'
            showTypes={['expression', 'function']}
            value={properties.judgment ?? true}
            onChange={(judgment) => onChange({ judgment })}
          />
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
