import { getElementLabel } from '@origamix/shared';
import type { EventTarget } from '../flow-editor/flow-graph';
import {
  Button,
  Checkbox,
  FieldLabel,
  Input,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@origamix/ui';

import { ChevronRight } from 'lucide-react';
import { useMaterialCatalog } from '../session/editor-environment';
import { SchemaUtils } from '../schema/schema-utils';
import { useEditorCore, type ActiveElement } from '../session/editor-session';
import { type AttributeConfig } from '../contracts/material-contracts';
import { useEffect, useMemo, useState } from 'react';
import type { JsonAttributeConfig } from '../contracts/property-editor-contracts';
import { JsonAttributeField } from '../components/json-attribute-field';

interface OptionItem {
  label: string;
  value: unknown;
}

const isNotEmpty = (value: unknown): boolean => {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const isVisible = (config: AttributeConfig, values: Record<string, unknown>): boolean => {
  const matches = (config.linkageShow ?? []).map((rule) => {
    const value = values[rule.field];
    if (rule.isNotEmpty) return isNotEmpty(value);
    return Object.prototype.hasOwnProperty.call(rule, 'value')
      ? value === rule.value
      : isNotEmpty(value);
  });
  return (config as AttributeConfig & { linkageMode?: 'any' }).linkageMode === 'any'
    ? matches.some(Boolean)
    : matches.every(Boolean);
};

const optionsOf = (config: AttributeConfig): OptionItem[] => {
  const props = config as AttributeConfig & { props?: { options?: OptionItem[] } };
  return Array.isArray(props.props?.options) ? props.props.options : [];
};

export const AttributePanel = ({
  onEditEvent,
}: {
  onEditEvent: (target: EventTarget) => void;
}): React.JSX.Element => {
  const { activeElement, materials, schema, setActiveElement, setSchema } = useEditorCore();
  const [activePanel, setActivePanel] = useState('0');
  const material = activeElement?.material;
  const catalog = useMaterialCatalog();
  const element = activeElement ? schema.elements[activeElement.id] : undefined;
  const values = element?.props ?? {};
  const parentTabsId = activeElement
    ? SchemaUtils.getParents(schema, activeElement.id).find(
        (id) => schema.elements[id]?.type === 'tabs',
      )
    : undefined;
  const tabItems =
    parentTabsId && Array.isArray(schema.elements[parentTabsId]?.props?.items)
      ? (schema.elements[parentTabsId]!.props.items as { key: string; label: string }[])
      : [];
  const allMethods = material?.contextConfig?.methods;
  const methods = allMethods?.filter((method) =>
    isVisible(method as unknown as AttributeConfig, { ...material?.defaultProps, ...values }),
  );
  const hiddenBindings = allMethods?.filter(
    (method) =>
      !methods?.includes(method) &&
      schema.bindElements?.some(
        (binding) => binding.id === activeElement?.id && binding.event === method.name,
      ),
  );
  const panels = [
    ...(material?.editorConfig?.panels ?? []).map((panel) => ({
      ...panel,
      configs: [
        ...(panel.configs ?? []),
        ...(panel.title === '属性' && parentTabsId
          ? [
              {
                field: 'tabKey',
                required: false,
                label: '所属页签',
                uiType: 'select',
                props: {
                  options: tabItems.map((item) => ({ label: item.label, value: item.key })),
                },
              },
            ]
          : []),
      ],
      kind: 'attributes' as const,
    })),
    ...(methods?.length ? [{ title: '事件', kind: 'events' as const, methods }] : []),
  ];

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActivePanel('0');
  }, [activeElement?.id]);

  const parents = useMemo<ActiveElement[]>(() => {
    if (!activeElement) return [];
    if (activeElement.parents?.length) return activeElement.parents;
    return SchemaUtils.getParents(schema, activeElement.id)
      .map((id) => {
        const parent = schema.elements[id];
        const parentMaterial = parent
          ? materials.find((item) => item.type === parent.type)
          : undefined;
        return parent && parentMaterial
          ? ({
              id,
              type: parent.type,
              props: parent.props ?? {},
              material: parentMaterial,
            } as ActiveElement)
          : null;
      })
      .filter((item): item is ActiveElement => item !== null);
  }, [activeElement, materials, schema]);

  const update = (field: string, value: unknown): void => {
    if (!activeElement) return;
    const manifest = catalog.find((item) => item.type === element?.type);
    const result = SchemaUtils.setElementProps(
      schema,
      activeElement.id,
      { [field]: value },
      manifest?.propsSchema,
    );
    setSchema(result.schema, { historyGroup: `props:${activeElement.id}:${field}` });
  };

  const renderField = (config: AttributeConfig): React.JSX.Element | null => {
    if (!config.uiType || !isVisible(config, { ...material?.defaultProps, ...values })) return null;
    const value =
      values[config.field] ?? config.defaultValue ?? material?.defaultProps?.[config.field];
    const options = optionsOf(config);
    const label = typeof config.label === 'string' ? config.label : config.field;

    switch (config.uiType) {
      case 'json':
        return (
          <JsonAttributeField
            key={`${activeElement?.id}:${config.field}:${JSON.stringify(value)}`}
            label={label}
            value={value}
            validateValue={(config as JsonAttributeConfig).validateValue}
            onChange={(next) => update(config.field, next)}
          />
        );
      case 'input':
        return (
          <Input
            aria-label={label}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => update(config.field, event.target.value)}
          />
        );
      case 'number': {
        const numberProps = (
          config as AttributeConfig & { props?: { min?: number; max?: number; step?: number } }
        ).props;
        return (
          <Input
            aria-label={label}
            type='number'
            min={numberProps?.min}
            max={numberProps?.max}
            step={numberProps?.step}
            value={typeof value === 'number' ? String(value) : ''}
            onChange={(event) =>
              update(
                config.field,
                event.target.value === '' ? undefined : Number(event.target.value),
              )
            }
          />
        );
      }
      case 'checkbox':
        if (options.length)
          return <p className='m-0 text-xs text-zinc-500'>多选配置将在后续版本支持。</p>;
        return (
          <label className='flex items-center gap-2 text-sm'>
            <Checkbox
              checked={Boolean(value)}
              onCheckedChange={(selected) => update(config.field, selected)}
            />
            {label}
          </label>
        );
      case 'switch':
        return (
          <label className='flex items-center gap-2 text-sm'>
            <Switch
              checked={Boolean(value)}
              onCheckedChange={(selected) => update(config.field, selected)}
            />
            {label}
          </label>
        );
      case 'radio':
        return (
          <RadioGroup
            aria-label={label}
            value={String(value ?? '')}
            onValueChange={(next) =>
              update(
                config.field,
                options.find((option) => String(option.value) === next)?.value ?? next,
              )
            }
          >
            {options.map((option) => (
              <label key={String(option.value)} className='flex items-center gap-2 text-sm'>
                <RadioGroupItem value={String(option.value)} />
                {option.label}
              </label>
            ))}
          </RadioGroup>
        );
      case 'select':
        return (
          <Select
            aria-label={label}
            items={options.map((option) => ({ label: option.label, value: String(option.value) }))}
            value={
              value == null
                ? options.some((option) => option.value === undefined)
                  ? 'undefined'
                  : null
                : String(value)
            }
            onValueChange={(key: string | null) =>
              update(
                config.field,
                options.find((option) => String(option.value) === String(key))?.value,
              )
            }
          >
            <SelectTrigger className='w-full' aria-label={label}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={String(option.value)} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'text':
        return (
          <span className='text-xs text-zinc-600 dark:text-zinc-300'>{String(value ?? '')}</span>
        );
      case 'custom': {
        const Component = (
          config as unknown as {
            render?: React.ComponentType<{
              value?: unknown;
              onChange?: (value: unknown) => void;
              elementProps?: Readonly<Record<string, unknown>>;
              fields?: readonly { name: string; label: string }[];
            }>;
          }
        ).render;
        return Component ? (
          <details
            key={`${activeElement?.id}:${config.field}:${JSON.stringify(value)}`}
            className='rounded border border-border p-2'
          >
            <summary className='cursor-pointer rounded text-xs font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring'>
              编辑{label}
            </summary>
            <div className='pt-3'>
              <Component
                key={`${activeElement?.id}:${config.field}:${JSON.stringify(value)}`}
                value={value}
                elementProps={values}
                fields={Object.keys(schema.elements)
                  .filter((id) => SchemaUtils.getParents(schema, id).includes(activeElement!.id))
                  .map((id: string) => schema.elements[id])
                  .filter(
                    (element) =>
                      typeof element?.props?.fieldName === 'string' && element.props.fieldName,
                  )
                  .map((element) => ({
                    name: String(element!.props.fieldName),
                    label: String(element!.props.fieldLabel || element!.props.fieldName),
                  }))}
                onChange={(next) => update(config.field, next)}
              />
            </div>
          </details>
        ) : null;
      }
      case 'color':
        return <p className='m-0 text-xs text-zinc-500'>暂不支持此配置控件。</p>;
      default:
        return null;
    }
  };

  return (
    <aside
      className='flex h-full w-70 shrink-0 flex-col border-l border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950'
      aria-label='属性面板'
    >
      {!activeElement ? (
        <div className='grid size-full place-items-center p-5 text-center text-sm text-zinc-600 dark:text-zinc-400'>
          请从左侧画布选中元素
        </div>
      ) : (
        <>
          <div className='flex h-10 shrink-0 items-center gap-1 overflow-x-auto overflow-y-hidden border-b border-zinc-200 px-3 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400'>
            {parents.map((parent) => (
              <button
                key={parent.id}
                type='button'
                className='flex shrink-0 items-center hover:text-blue-600 dark:hover:text-blue-400'
                onClick={() => setActiveElement(parent)}
              >
                <span
                  className='max-w-24 truncate'
                  title={getElementLabel(
                    parent.id,
                    schema.elements[parent.id],
                    String(parent.material.title),
                  )}
                >
                  {getElementLabel(
                    parent.id,
                    schema.elements[parent.id],
                    String(parent.material.title),
                  )}
                </span>
                <ChevronRight size={12} className='mx-1' />
              </button>
            ))}
            <span
              className='shrink-0'
              title={getElementLabel(
                activeElement.id,
                schema.elements[activeElement.id],
                String(activeElement.material.title),
              )}
            >
              {getElementLabel(
                activeElement.id,
                schema.elements[activeElement.id],
                String(activeElement.material.title),
              )}
            </span>
          </div>
          {panels.length === 0 ? (
            <p className='p-4 text-xs text-zinc-500'>此物料没有可编辑属性。</p>
          ) : (
            <div className='flex min-h-0 flex-1 flex-col'>
              <div
                className='flex h-10 shrink-0 items-end gap-1 overflow-x-auto border-b border-zinc-200 px-2 dark:border-zinc-800'
                role='tablist'
                aria-label='属性分类'
              >
                {panels.map((panel, index) => (
                  <button
                    key={`${String(panel.title)}-${index}`}
                    type='button'
                    role='tab'
                    aria-selected={activePanel === String(index)}
                    className={`h-full shrink-0 border-b-2 px-2 text-xs font-medium ${activePanel === String(index) ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setActivePanel(String(index))}
                  >
                    {panel.title}
                  </button>
                ))}
              </div>
              <div className='min-h-0 flex-1 overflow-auto p-3'>
                {panels.map((panel, index) => {
                  if (activePanel !== String(index)) return null;
                  if (panel.kind === 'events') {
                    return (
                      <div key='events'>
                        {!!hiddenBindings?.length && (
                          <p role='status' className='mb-2 text-xs text-muted-foreground'>
                            当前模式不支持的已有事件绑定：
                            {hiddenBindings
                              .map((method) => method.description || method.name)
                              .join('、')}
                            。绑定已保留，请调整模式或在逻辑视图处理。
                          </p>
                        )}
                        {panel.methods.map((method) => (
                          <Button
                            variant='outline'
                            key={method.name}
                            data-flow-event={method.name}
                            className='mb-2 w-full justify-start text-xs'
                            onClick={() =>
                              onEditEvent({
                                elementId: activeElement.id,
                                event: method.name,
                                label: method.description || method.name,
                              })
                            }
                          >
                            <span>
                              {method.description || method.name}（{method.name}）
                            </span>
                          </Button>
                        ))}
                      </div>
                    );
                  }
                  return (
                    <div key={`${String(panel.title)}-${index}`} className='space-y-3'>
                      {(panel.configs ?? []).map((config) => {
                        const field = renderField(config);
                        if (!field) return null;
                        const label =
                          typeof config.label === 'string' ? config.label : config.field;
                        const standalone =
                          config.uiType === 'checkbox' || config.uiType === 'switch';
                        return (
                          <div key={config.field}>
                            {!standalone && (
                              <FieldLabel className='mb-1.5 block text-[11px] text-zinc-500'>
                                {label}
                                {config.required ? ' *' : ''}
                              </FieldLabel>
                            )}
                            {field}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
};
