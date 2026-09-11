import { Checkbox, Input, Label, ListBox, Radio, RadioGroup, Select, Switch } from '@heroui/react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { SchemaUtils } from '@tangramino/engine';
import { useEditorCore, type AttributeConfig } from '@tangramino/base-editor';

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
  const { activeElement, schema, setSchema } = useEditorCore();
  const material = activeElement?.material;
  const element = activeElement ? schema.elements[activeElement.id] : undefined;
  const values = element?.props ?? {};
  const panels = material?.editorConfig?.panels ?? [];

  const update = (field: string, value: unknown): void => {
    if (!activeElement) return;
    const result = SchemaUtils.setElementProps(schema, activeElement.id, { [field]: value });
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
          <Checkbox
            isSelected={Boolean(value)}
            onChange={(selected) => update(config.field, selected)}
          >
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Checkbox.Content>{label}</Checkbox.Content>
          </Checkbox>
        );
      case 'switch':
        return (
          <Switch
            isSelected={Boolean(value)}
            onChange={(selected) => update(config.field, selected)}
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Switch.Content>{label}</Switch.Content>
          </Switch>
        );
      case 'radio':
        return (
          <RadioGroup
            aria-label={label}
            value={String(value ?? '')}
            onChange={(next) =>
              update(
                config.field,
                options.find((option) => String(option.value) === next)?.value ?? next,
              )
            }
          >
            {options.map((option) => (
              <Radio key={String(option.value)} value={String(option.value)}>
                <Radio.Content>
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  {option.label}
                </Radio.Content>
              </Radio>
            ))}
          </RadioGroup>
        );
      case 'select':
        return (
          <Select
            aria-label={label}
            selectedKey={value == null ? null : String(value)}
            onSelectionChange={(key) =>
              update(
                config.field,
                options.find((option) => String(option.value) === String(key))?.value,
              )
            }
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator>
                <ChevronDown size={14} />
              </Select.Indicator>
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {options.map((option) => (
                  <ListBox.Item
                    key={String(option.value)}
                    id={String(option.value)}
                    textValue={option.label}
                  >
                    {option.label}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
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
    <aside
      className='flex w-72 shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'
      aria-label='属性面板'
    >
      <div className='flex h-10 items-center gap-2 border-b border-zinc-200 px-3 text-xs font-semibold dark:border-zinc-800'>
        <SlidersHorizontal size={15} />
        属性
      </div>
      {!activeElement ? (
        <div className='grid min-h-0 flex-1 place-items-center p-5 text-center text-xs text-zinc-500'>
          从画布中选择一个元素
        </div>
      ) : (
        <div className='min-h-0 flex-1 overflow-auto p-3'>
          <p className='mt-0 mb-3 truncate text-xs font-medium'>
            {material?.title} · {activeElement.id}
          </p>
          {panels.length === 0 ? (
            <p className='text-xs text-zinc-500'>此物料没有可编辑属性。</p>
          ) : (
            panels.map((panel, panelIndex) => (
              <section key={`${String(panel.title)}-${panelIndex}`} className='mb-5'>
                <h3 className='mb-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300'>
                  {panel.title}
                </h3>
                <div className='space-y-3'>
                  {(panel.configs ?? []).map((config) => {
                    const field = renderField(config);
                    if (!field) return null;
                    const label = typeof config.label === 'string' ? config.label : config.field;
                    const standalone = config.uiType === 'checkbox' || config.uiType === 'switch';
                    return (
                      <div key={config.field}>
                        {!standalone && (
                          <Label className='mb-1.5 block text-[11px] text-zinc-500'>
                            {label}
                            {config.required ? ' *' : ''}
                          </Label>
                        )}
                        {field}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      )}
    </aside>
  );
};
