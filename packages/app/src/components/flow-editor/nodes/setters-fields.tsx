import { getElementLabel } from '@origamix/shared/protocol/schema';
import { useEditorCore } from '@tangramino/base-editor';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/field';
import { FlowSelect } from '../flow-select';
import { ValueField } from './value-field';
import { asRecord } from './values';
import { getAntdMaterialManifests } from '@origamix/materials/antd/manifest';
import { defaultNodeProps } from './definitions';

export const SettersFields = ({
  type,
  properties,
  onChange,
}: {
  type: string;
  properties: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}): React.JSX.Element => {
  const schema = useEditorCore((state) => state.schema);
  const materials = useEditorCore((state) => state.materials);
  const global = type === 'setGlobalVariable';
  const method = type === 'emitElementAction';
  // Existing single-target nodes remain editable without rewriting their format on mount.
  const legacy =
    global && properties.name
      ? [{ name: properties.name, value: properties.value }]
      : !method && properties.elementId
        ? Object.entries(asRecord(properties.value)).map(([propName, value]) => ({
            elementId: properties.elementId,
            propName,
            value,
          }))
        : [];
  const setters: Record<string, unknown>[] = Array.isArray(properties.setters)
    ? properties.setters.map(asRecord)
    : legacy;
  const [keys, setKeys] = useState(() => setters.map(() => crypto.randomUUID()));
  const patch = (index: number, value: Record<string, unknown>): void =>
    onChange({
      setters: setters.map((setter, i) => (i === index ? { ...setter, ...value } : setter)),
    });
  const label = global ? '全局变量设置' : method ? '触发元素方法' : '元素属性设置';
  return (
    <div className='space-y-3'>
      {global && !schema.context?.globalVariables?.length && (
        <p className='text-xs text-muted-foreground'>请先在页面工具的全局变量中定义变量。</p>
      )}
      {setters.map((setter, index) => {
        const element = schema.elements[String(setter.elementId ?? '')];
        const material = materials.find((item) => item.type === element?.type);
        const fieldLabels = new Map(
          (material?.editorConfig?.panels ?? []).flatMap((panel) =>
            (panel.configs ?? []).map((field) => [field.field, field.label] as const),
          ),
        );
        const declaredProps = getAntdMaterialManifests([element?.type ?? ''])[0]?.propsSchema
          .properties as Record<string, { description?: string }> | undefined;
        const declaredFields = Object.entries(declaredProps ?? {}).map(([name, definition]) => ({
          name,
          description:
            typeof fieldLabels.get(name) === 'string'
              ? String(fieldLabels.get(name))
              : (definition.description ?? name),
        }));
        const fields = method
          ? (material?.contextConfig?.contextValues ?? []).filter((item) => item.isMethod)
          : [
              ...declaredFields,
              ...(material?.contextConfig?.variables ?? []).filter(
                (field) => !declaredProps?.[field.name],
              ),
            ];
        return (
          <div key={keys[index] ?? index} className='space-y-2 rounded-md border border-border p-2'>
            <div className='flex items-center justify-between'>
              <span className='text-xs font-medium'>
                {label} {index + 1}
              </span>
              <Button
                variant='ghost'
                size='icon-sm'
                aria-label={`删除${label} ${index + 1}`}
                onClick={() => {
                  onChange({ setters: setters.filter((_, i) => i !== index) });
                  setKeys((current) => current.filter((_, i) => i !== index));
                }}
              >
                <Trash2 size={13} />
              </Button>
            </div>
            <FieldLabel>{global ? '全局变量' : '目标组件'}</FieldLabel>
            <FlowSelect
              label={`${label} ${index + 1} ${global ? '全局变量' : '目标组件'}`}
              value={String(global ? (setter.name ?? '') : (setter.elementId ?? ''))}
              options={
                global
                  ? (schema.context?.globalVariables ?? []).map((variable) => ({
                      value: variable.name,
                      label: variable.name,
                    }))
                  : Object.entries(schema.elements).map(([id, item]) => ({
                      value: id,
                      label: getElementLabel(
                        id,
                        item,
                        String(
                          materials.find((material) => material.type === item.type)?.title ??
                            item.type,
                        ),
                      ),
                    }))
              }
              onChange={(value) =>
                patch(
                  index,
                  global
                    ? { name: value }
                    : { elementId: value, ...(method ? { methodName: '' } : { propName: '' }) },
                )
              }
            />
            {!global && (
              <>
                <FieldLabel>{method ? '方法' : '属性'}</FieldLabel>
                <FlowSelect
                  label={`${label} ${index + 1} ${method ? '方法' : '属性'}`}
                  value={String(method ? (setter.methodName ?? '') : (setter.propName ?? ''))}
                  options={fields.map((field) => ({
                    value: field.name,
                    label: field.description || field.name,
                  }))}
                  onChange={(value) =>
                    patch(index, method ? { methodName: value } : { propName: value })
                  }
                />
                {fields.length === 0 && (
                  <p className='text-xs text-muted-foreground'>
                    {element ? `此组件没有公开的${method ? '方法' : '属性'}` : '请先选择组件'}
                  </p>
                )}
              </>
            )}
            <ValueField
              label={method ? '方法参数（JSON 数组）' : '设置值'}
              value={setter.value}
              onChange={(value) => patch(index, { value })}
            />
          </div>
        );
      })}
      <Button
        variant='outline'
        size='sm'
        className='w-full'
        onClick={() => {
          onChange({
            setters: [
              ...setters,
              (defaultNodeProps(type).setters as Record<string, unknown>[])[0]!,
            ],
          });
          setKeys((current) => [...current, crypto.randomUUID()]);
        }}
      >
        <Plus size={13} />
        添加{label}
      </Button>
    </div>
  );
};
