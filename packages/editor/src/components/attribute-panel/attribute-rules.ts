import type { AttributeConfig } from '../../interfaces/material-interfaces';

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

export const isVisible = (config: AttributeConfig, values: Record<string, unknown>): boolean => {
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

export const optionsOf = (config: AttributeConfig): OptionItem[] => {
  const props = config as AttributeConfig & { props?: { options?: OptionItem[] } };
  return Array.isArray(props.props?.options) ? props.props.options : [];
};
