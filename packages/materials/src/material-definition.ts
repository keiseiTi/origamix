import type { JsonSchema, MaterialManifest } from '@origamix/shared';
import type { AttributeConfig } from './material';
import type { MaterialDefinition } from './origamix-material';
import { withCommonMaterialManifest } from './material-manifest';
import { materialSet } from '../antd/material-set';

const inferSchema = (config: AttributeConfig): JsonSchema => {
  if (config.schema) return config.schema;
  switch (config.uiType) {
    case 'input':
    case 'text':
    case 'color':
      return { type: 'string' };
    case 'checkbox':
    case 'switch':
      return { type: 'boolean' };
    case 'number': {
      const { min, max } = config.props ?? {};
      return {
        type: 'number',
        ...(min !== undefined ? { minimum: Number(min) } : {}),
        ...(max !== undefined ? { maximum: Number(max) } : {}),
      };
    }
    case 'radio':
    case 'select': {
      const values = [
        ...new Set(
          config.props?.options
            ?.map((option) => option.value)
            .filter((value) => value !== undefined),
        ),
      ];
      if (!values.length) throw new Error(`${config.field}: 静态选项为空，请显式声明 schema`);
      const types = [...new Set(values.map((value) => typeof value))];
      return { ...(types.length === 1 ? { type: types[0] } : {}), enum: values };
    }
    default:
      throw new Error(`${config.field}: 自定义或复杂属性必须声明 schema`);
  }
};

/** Field-local references must resolve inside the field after embedding in propsSchema. */
const scopeSchema = (schema: JsonSchema, field: string): JsonSchema => {
  const prefix = `#/properties/${field.replaceAll('~', '~0').replaceAll('/', '~1')}`;
  const rewrite = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(rewrite);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        key === '$ref' && typeof item === 'string' && (item === '#' || item.startsWith('#/'))
          ? `${prefix}${item.slice(1)}`
          : ['default', 'const', 'enum', 'examples'].includes(key)
            ? item
            : rewrite(item),
      ]),
    );
  };
  return rewrite(schema) as JsonSchema;
};

/** Extract only protocol data; never copy components, controls or validators. */
export const createMaterialManifest = (definition: MaterialDefinition): MaterialManifest => {
  const { Component: _Component, editorConfig, defaultProps = {}, ...metadata } = definition;
  const properties: Record<string, JsonSchema> = {};
  const defaults = { ...defaultProps };
  const required: string[] = [];
  for (const panel of editorConfig?.panels ?? []) {
    for (const config of panel.configs ?? []) {
      if (config.field in properties) throw new Error(`${metadata.type}: 重复属性 ${config.field}`);
      properties[config.field] = scopeSchema(inferSchema(config), config.field);
      if (config.required) required.push(config.field);
      if (config.defaultValue !== undefined) {
        if (
          config.field in defaults &&
          JSON.stringify(defaults[config.field]) !== JSON.stringify(config.defaultValue)
        ) {
          throw new Error(`${metadata.type}.${config.field}: 默认值重复且不一致`);
        }
        defaults[config.field] = config.defaultValue;
      }
    }
  }
  return withCommonMaterialManifest({
    ...metadata,
    version: materialSet.version,
    defaultProps: defaults,
    propsSchema: { type: 'object', additionalProperties: false, properties, required },
  });
};
