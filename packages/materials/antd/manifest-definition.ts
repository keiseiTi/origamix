import { materialSet } from './material-set';
import { withCommonMaterialManifest } from '../src/material-manifest';
import type { JsonSchema, MaterialManifest } from '@origamix/shared';

export const objectSchema = (
  properties: Readonly<Record<string, JsonSchema>>,
  required: readonly string[] = [],
): JsonSchema => ({
  type: 'object',
  additionalProperties: false,
  properties,
  ...(required.length > 0 ? { required } : {}),
});

/** Every built-in component follows the installed Ant Design material-set version. */
export const defineManifest = (
  manifest: Omit<MaterialManifest, 'version'> & { version?: never },
): MaterialManifest => withCommonMaterialManifest({ ...manifest, version: materialSet.version });

export const emptyContext: MaterialManifest['context'] = {
  variables: [],
  values: [],
  methods: [],
};

export const inputContext: MaterialManifest['context'] = {
  variables: [
    { name: 'value', description: '当前值' },
    { name: 'disabled', description: '是否禁用' },
  ],
  values: [],
  methods: [
    {
      name: 'onChange',
      description: '值改变时的回调',
      params: [{ description: '事件参数' }],
    },
  ],
};

const optionSchema = objectSchema(
  {
    label: { type: 'string' },
    value: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
  },
  ['label', 'value'],
);

export const optionsSchema: JsonSchema = { type: 'array', items: optionSchema };
