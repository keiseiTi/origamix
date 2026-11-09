import {
  Checkbox,
  ColorPicker,
  Input,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  FieldLabel,
} from '@origamix/ui';
import type { OrigamixPageSchema } from '@origamix/shared';
import type { AttributeConfig, Material } from '../../interfaces/material-interfaces';
import type { JsonAttributeConfig } from '../../interfaces/property-editor-interfaces';
import { SchemaUtils } from '../../schema/schema-utils';
import { JsonAttributeField } from '../json-attribute-field';
import { isVisible, optionsOf } from './attribute-rules';

interface AttributeFieldProps {
  config: AttributeConfig;
  elementId: string;
  material: Material | undefined;
  values: Record<string, unknown>;
  schema: OrigamixPageSchema;
  update: (field: string, value: unknown) => void;
}

export const AttributeField = ({
  config,
  ...props
}: AttributeFieldProps): React.JSX.Element | null => {
  if (!config.uiType || !isVisible(config, { ...props.material?.defaultProps, ...props.values }))
    return null;
  const label = typeof config.label === 'string' ? config.label : config.field;
  const field = renderAttributeControl({ config, ...props });
  if (!field) return null;
  const standalone = config.uiType === 'checkbox' || config.uiType === 'switch';
  return (
    <div>
      {!standalone && (
        <FieldLabel className='mb-1.5 block text-[11px] text-zinc-500'>
          {label}
          {config.required ? ' *' : ''}
        </FieldLabel>
      )}
      {field}
    </div>
  );
};

const renderAttributeControl = ({
  config,
  elementId,
  material,
  values,
  schema,
  update,
}: AttributeFieldProps): React.JSX.Element | null => {
  const value = Object.hasOwn(values, config.field)
    ? values[config.field]
    : material?.defaultProps?.[config.field];
  const options = optionsOf(config);
  const label = typeof config.label === 'string' ? config.label : config.field;
  switch (config.uiType) {
    case 'json':
      return (
        <JsonAttributeField
          key={`${elementId}:${config.field}:${JSON.stringify(value)}`}
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
            update(config.field, event.target.value === '' ? undefined : Number(event.target.value))
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
        <div className='pt-3'>
          <Component
            key={`${elementId}:${config.field}:${config.resetOnValueChange === false ? '' : JSON.stringify(value)}`}
            value={value}
            elementProps={values}
            fields={Object.keys(schema.elements)
              .filter((id) => SchemaUtils.getParents(schema, id).includes(elementId))
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
      ) : null;
    }
    case 'color':
      return (
        <ColorPicker
          key={`${elementId}:${config.field}`}
          aria-label={label}
          value={typeof value === 'string' ? value : ''}
          onChange={(next) => update(config.field, next)}
        />
      );
    default:
      return null;
  }
};
