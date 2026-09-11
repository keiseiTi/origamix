import type { JsonSchema, MaterialManifest } from '@/material-manifest';

export const objectSchema = (
  properties: Readonly<Record<string, JsonSchema>>,
  required: readonly string[] = [],
): JsonSchema => ({
  type: 'object',
  additionalProperties: false,
  properties,
  ...(required.length > 0 ? { required } : {}),
});

type MaterialCore = Pick<MaterialManifest, 'type' | 'title' | 'defaultProps' | 'context'>;
type ManifestDetails = Omit<MaterialManifest, keyof MaterialCore>;

export const defineManifest = (core: MaterialCore, details: ManifestDetails): MaterialManifest => {
  return { ...core, ...details };
};

export const defineSimpleManifest = (
  core: MaterialCore,
  details: Omit<ManifestDetails, 'version'>,
): MaterialManifest => defineManifest(core, { version: '1.0.0', ...details });

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
  { label: { type: 'string' }, value: { type: ['string', 'number', 'boolean'] } },
  ['label', 'value'],
);

export const optionsSchema: JsonSchema = { type: 'array', items: optionSchema };

export const defineDateInputManifest = (
  type: 'datePicker' | 'datePickerRange' | 'timePicker',
  title: string,
  props: Readonly<Record<string, JsonSchema>>,
): MaterialManifest =>
  defineSimpleManifest(
    { type, title, defaultProps: {}, context: type === 'timePicker' ? emptyContext : inputContext },
    {
      description: `用于选择${title.replace('选择器', '')}。`,
      keywords: [title, '日期时间', '选择'],
      role: 'input',
      acceptsChildren: false,
      allowedParentTypes: ['form'],
      propsSchema: objectSchema(props),
      usage: `用于表单中的${title}字段。`,
      constraints: ['必须置于 form 中。'],
    },
  );

export const defineOptionInputManifest = (
  type: 'cascader' | 'treeSelect',
  title: string,
  variableName: 'options' | 'treeData',
): MaterialManifest =>
  defineSimpleManifest(
    {
      type,
      title,
      defaultProps: { options: [{ label: '示例1', value: '示例1' }] },
      context: {
        ...inputContext,
        variables: [
          ...inputContext.variables,
          { name: variableName, description: type === 'cascader' ? '选项' : '树节点数据' },
        ],
      },
    },
    {
      description: type === 'cascader' ? '从层级关联选项中选择值。' : '从树形数据中选择值。',
      keywords: [title, '层级', '选择'],
      role: 'input',
      acceptsChildren: false,
      allowedParentTypes: ['form'],
      propsSchema: objectSchema({
        options: optionsSchema,
        treeData: { type: 'array', items: { type: 'object' } },
        placeholder: { type: 'string' },
        multiple: { type: 'boolean' },
        allowClear: { type: 'boolean' },
      }),
      usage: `用于表单中的${title}字段。`,
      constraints: ['必须置于 form 中。'],
    },
  );

export const defineOverlayManifest = (type: 'modal' | 'drawer', title: string): MaterialManifest =>
  defineSimpleManifest(
    {
      type,
      title,
      defaultProps: { title: type === 'modal' ? '弹窗标题' : '抽屉标题' },
      context: emptyContext,
    },
    {
      description: type === 'modal' ? '在页面上方显示模态内容。' : '从页面边缘展开辅助内容。',
      keywords: [title, '浮层', '容器'],
      role: 'overlay',
      acceptsChildren: true,
      propsSchema: objectSchema(
        type === 'modal'
          ? {
              title: { type: 'string' },
              width: { type: 'number', minimum: 200, maximum: 1200 },
              cancelText: { type: 'string' },
              okText: { type: 'string' },
              centered: { type: 'boolean' },
              maskClosable: { type: 'boolean' },
              forceRender: { type: 'boolean' },
              mask: { type: 'boolean' },
              keyboard: { type: 'boolean' },
            }
          : {
              title: { type: 'string' },
              width: { type: 'number', minimum: 200, maximum: 1200 },
              placement: { type: 'string', enum: ['left', 'right', 'top', 'bottom'] },
              closable: { type: 'boolean' },
              maskClosable: { type: 'boolean' },
              forceRender: { type: 'boolean' },
            },
      ),
      usage: '承载需要临时展示的内容。',
      constraints: ['子元素应保持可访问的阅读和操作顺序。'],
    },
  );
