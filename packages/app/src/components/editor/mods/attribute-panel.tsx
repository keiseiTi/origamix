import { Checkbox } from '../../ui/checkbox';
import { FieldLabel } from '../../ui/field';
import { Input } from '../../ui/input';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Switch } from '../../ui/switch';
import { ChevronRight } from 'lucide-react';
import { SchemaUtils } from '@tangramino/engine';
import {
  useEditorCore,
  usePluginCore,
  type ActiveElement,
  type AttributeConfig,
} from '@tangramino/base-editor';
import { useEffect, useMemo, useState } from 'react';

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
  return (config.linkageShow ?? []).every((rule) => {
    const value = values[rule.field];
    if (rule.isNotEmpty) return isNotEmpty(value);
    return Object.prototype.hasOwnProperty.call(rule, 'value')
      ? value === rule.value
      : isNotEmpty(value);
  });
};

const optionsOf = (config: AttributeConfig): OptionItem[] => {
  const props = config as AttributeConfig & { props?: { options?: OptionItem[] } };
  return Array.isArray(props.props?.options) ? props.props.options : [];
};

export const AttributePanel = (): React.JSX.Element => {
  const { activeElement, materials, schema, setActiveElement, setSchema } = useEditorCore();
  const { callSchemaHook } = usePluginCore();
  const [activePanel, setActivePanel] = useState('0');
  const material = activeElement?.material;
  const element = activeElement ? schema.elements[activeElement.id] : undefined;
  const values = element?.props ?? {};
  const panels = material?.editorConfig?.panels ?? [];

  useEffect(() => setActivePanel('0'), [activeElement?.id]);

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
    const operation = {
      elementId: activeElement.id,
      props: { [field]: value },
      oldProps: { [field]: values[field] },
    };
    if (callSchemaHook('onBeforeUpdateProps', schema, operation) === false) return;
    const result = SchemaUtils.setElementProps(schema, activeElement.id, { [field]: value });
    callSchemaHook('onAfterUpdateProps', result.schema, result.operation);
    setSchema(result.schema);
  };

  const renderField = (config: AttributeConfig): React.JSX.Element | null => {
    if (!config.uiType || !isVisible(config, values)) return null;
    const value = values[config.field] ?? config.defaultValue;
    const options = optionsOf(config);
    const label = typeof config.label === 'string' ? config.label : config.field;

    switch (config.uiType) {
      case 'input':
        return (
          <Input
            aria-label={label}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => update(config.field, event.target.value)}
          />
        );
      case 'number':
        return (
          <Input
            aria-label={label}
            type='number'
            value={typeof value === 'number' ? String(value) : ''}
            onChange={(event) =>
              update(
                config.field,
                event.target.value === '' ? undefined : Number(event.target.value),
              )
            }
          />
        );
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
            value={value == null ? null : String(value)}
            onValueChange={(key: string | null) =>
              update(
                config.field,
                options.find((option) => String(option.value) === String(key))?.value,
              )
            }
          >
            <SelectTrigger className='w-full'>
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
      case 'custom':
      case 'color':
        return <p className='m-0 text-xs text-zinc-500'>该配置控件暂未接入 MVP。</p>;
      default:
        return null;
    }
  };

  return (
    <aside className='flex h-full w-70 shrink-0 flex-col border-l border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950' aria-label='属性面板'>
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
                <span className='max-w-24 truncate' title={String(parent.material.title)}>
                  {parent.material.title}
                </span>
                <ChevronRight size={12} className='mx-1' />
              </button>
            ))}
            <span className='shrink-0' title={String(material?.title)}>
              {material?.title}
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
