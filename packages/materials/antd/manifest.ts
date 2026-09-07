import {
  MATERIAL_MANIFEST_FORMAT_VERSION,
  toAgentMaterialSummary,
  toValidationMaterialManifest,
  type JsonSchema,
  type MaterialManifest,
  type MaterialManifestCatalog,
} from '../src/material-manifest';

const objectSchema = (
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

function defineManifest(core: MaterialCore, details: ManifestDetails): MaterialManifest {
  return {
    ...core,
    ...details,
  };
}

export const containerManifest = defineManifest(
  {
    type: 'container',
    title: '容器',
    defaultProps: { heightConfig: 'fixed', height: 200 },
    context: { variables: [], values: [], methods: [] },
  },
  {
    version: '1.0.0',
    description: '用于组织其他元素并控制区域尺寸和间距。',
    keywords: ['容器', '布局', '分区'],
    role: 'layout',
    acceptsChildren: true,
    propsSchema: objectSchema({
      heightConfig: { type: 'string', enum: ['fixed', 'auto'] },
      height: { type: 'number', minimum: 0 },
      margin: { type: 'number' },
      padding: { type: 'number' },
    }),
    usage: '用作页面区域或多个物料的父级容器。',
    constraints: ['固定高度仅在 heightConfig 为 fixed 时使用。'],
  },
);

export const formManifest = defineManifest(
  {
    type: 'form',
    title: '表单容器',
    defaultProps: { layout: 'horizontal' },
    context: {
      variables: [
        { name: 'value', description: '表单值' },
        { name: 'disabled', description: '是否禁用' },
      ],
      values: [
        { name: 'value', description: '表单值' },
        { name: 'validateFields', description: '表单校验', isMethod: true },
        { name: 'resetFields', description: '表单重置', isMethod: true },
      ],
      methods: [],
    },
  },
  {
    version: '1.0.0',
    description: '组织输入控件并提供表单值、校验和重置能力。',
    keywords: ['表单', '录入', '校验'],
    role: 'layout',
    acceptsChildren: true,
    allowedParentTypes: ['basicPage', 'container'],
    propsSchema: objectSchema({
      layout: { type: 'string', enum: ['horizontal', 'vertical', 'inline'] },
      size: { type: 'string', enum: ['large', 'middle', 'small'] },
      labelAlign: { type: 'string', enum: ['left', 'right'] },
      labelColVal: { type: 'number', minimum: 0, maximum: 24 },
      wrapperColVal: { type: 'number', minimum: 0, maximum: 24 },
      scrollToFirstError: { type: 'boolean' },
    }),
    usage: '作为输入类物料的父级，配置整体布局与校验行为。',
    constraints: ['输入类子元素应放入表单容器。'],
  },
);

export const inputManifest = defineManifest(
  {
    type: 'input',
    title: '输入框',
    defaultProps: { placeholder: '请输入内容' },
    context: {
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
        {
          name: 'onPressEnter',
          description: '回车的回调',
          params: [{ description: '事件参数' }],
        },
      ],
    },
  },
  {
    version: '1.0.0',
    description: '录入单行文本。',
    keywords: ['输入框', '文本', '字段'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    propsSchema: objectSchema({
      type: { type: 'string', enum: ['text', 'password', 'email'] },
      maxLength: { type: 'number', minimum: 0, maximum: 1000 },
      addonBefore: { type: 'string' },
      addonAfter: { type: 'string' },
      placeholder: { type: 'string' },
      allowClear: { type: 'boolean' },
      showCount: { type: 'boolean' },
    }),
    usage: '用于姓名、标题、账号、邮箱或密码等单行字段；密码字段使用 type=password。',
    constraints: ['必须置于 form 中。'],
  },
);

export const selectManifest = defineManifest(
  {
    type: 'select',
    title: '选择器',
    defaultProps: {
      placeholder: '请选择',
      size: 'middle',
      options: [
        { label: '选项一', value: 'option1' },
        { label: '选项二', value: 'option2' },
      ],
    },
    context: {
      variables: [
        { name: 'value', description: '当前值' },
        { name: 'disabled', description: '是否禁用' },
        { name: 'options', description: '选项' },
      ],
      values: [],
      methods: [
        {
          name: 'onChange',
          description: '值改变时的回调',
          params: [{ description: '事件参数' }],
        },
      ],
    },
  },
  {
    version: '1.0.0',
    description: '从预定义选项中选择一个或多个值。',
    keywords: ['选择器', '下拉框', '选项'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    propsSchema: objectSchema({
      mode: { type: 'string', enum: ['multiple', 'tags'] },
      placeholder: { type: 'string' },
      allowClear: { type: 'boolean' },
      size: { type: 'string', enum: ['large', 'middle', 'small'] },
      options: {
        type: 'array',
        items: objectSchema({ label: { type: 'string' }, value: { type: ['string', 'boolean'] } }, [
          'label',
          'value',
        ]),
      },
    }),
    usage: '用于枚举值、分类或状态字段。',
    constraints: ['必须置于 form 中。', '每个选项必须包含 label 和 value。'],
  },
);

export const switchManifest = defineManifest(
  {
    type: 'switch',
    title: '开关',
    defaultProps: {},
    context: {
      variables: [
        { name: 'checked', description: '是否选中' },
        { name: 'disabled', description: '是否禁用' },
        { name: 'loading', description: '加载中的开关' },
      ],
      values: [],
      methods: [
        {
          name: 'onChange',
          description: '值改变时的回调',
          params: [{ description: '事件参数' }],
        },
      ],
    },
  },
  {
    version: '1.0.0',
    description: '录入开启或关闭两种状态。',
    keywords: ['开关', '布尔值', '启用'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    propsSchema: objectSchema({ defaultChecked: { type: 'boolean' } }),
    usage: '用于启用、停用等布尔字段。',
    constraints: ['必须置于 form 中。'],
  },
);

export const buttonManifest = defineManifest(
  {
    type: 'button',
    title: '按钮',
    defaultProps: { text: '按钮', type: 'default', size: 'middle' },
    context: {
      variables: [
        { name: 'text', description: '按钮文本' },
        { name: 'disabled', description: '禁用按钮' },
        { name: 'loading', description: '按钮载入状态' },
      ],
      values: [],
      methods: [
        {
          name: 'onClick',
          description: '点击事件',
          params: [{ description: '事件参数' }],
        },
      ],
    },
  },
  {
    version: '1.0.0',
    description: '触发提交、重置、跳转或其他页面操作。',
    keywords: ['按钮', '提交', '操作'],
    role: 'action',
    acceptsChildren: false,
    propsSchema: objectSchema({
      text: { type: 'string' },
      type: { type: 'string', enum: ['default', 'primary', 'dashed', 'link', 'text'] },
      size: { type: 'string', enum: ['large', 'middle', 'small'] },
      shape: { type: 'string', enum: ['circle', 'round'] },
      href: { type: 'string' },
      target: { type: 'string', enum: ['_self', '_blank'] },
      ghost: { type: 'boolean' },
    }),
    usage: '为表单或页面提供清晰的用户操作入口。',
    constraints: ['仅在配置 href 时使用 target。'],
  },
);

export const tableManifest = defineManifest(
  {
    type: 'table',
    title: '表格',
    defaultProps: {
      rowKey: 'id',
      size: 'middle',
      columns: [
        { title: '列1', dataIndex: 'col1' },
        { title: '列2', dataIndex: 'col2' },
      ],
      enabledPagination: false,
    },
    context: {
      variables: [
        { name: 'dataSource', description: '数据源' },
        { name: 'loading', description: '加载中' },
        { name: 'bordered', description: '是否显示边框' },
      ],
      values: [],
      methods: [],
    },
  },
  {
    version: '1.0.0',
    description: '按列展示结构化列表数据。',
    keywords: ['表格', '列表', '数据'],
    role: 'display',
    acceptsChildren: false,
    propsSchema: objectSchema(
      {
        rowKey: { type: 'string', minLength: 1 },
        size: { type: 'string', enum: ['large', 'middle', 'small'] },
        columns: {
          type: 'array',
          items: objectSchema(
            {
              title: { type: 'string' },
              dataIndex: { type: 'string' },
              key: { type: 'string' },
            },
            ['title', 'dataIndex'],
          ),
        },
        dataSource: { type: 'array', items: { type: 'object' } },
        enabledPagination: { type: 'boolean' },
        bordered: { type: 'boolean' },
      },
      ['rowKey', 'columns'],
    ),
    usage: '用于展示具有稳定字段结构的数据集合。',
    constraints: ['rowKey 必须对应每行数据的唯一字段。', '列的 dataIndex 应对应数据字段。'],
  },
);

export const textManifest = defineManifest(
  {
    type: 'text',
    title: '文本',
    defaultProps: { text: '文本' },
    context: {
      variables: [
        { name: 'text', description: '文本内容' },
        { name: 'type', description: '文本类型' },
        { name: 'copyable', description: '是否可复制' },
        { name: 'editable', description: '是否可编辑' },
        { name: 'underline', description: '是否下划线' },
        { name: 'strong', description: '是否加粗' },
        { name: 'italic', description: '是否斜体' },
        { name: 'textType', description: '文本类型' },
        { name: 'ellipsis', description: '是否省略号' },
        { name: 'code', description: '是否代码样式' },
        { name: 'mark', description: '是否标记样式' },
      ],
      values: [],
      methods: [{ name: 'onClick', description: '点击文本时触发' }],
    },
  },
  {
    version: '1.0.0',
    description: '显示标题、段落或普通文本。',
    keywords: ['文本', '标题', '段落'],
    role: 'display',
    acceptsChildren: false,
    propsSchema: objectSchema({
      text: { type: 'string' },
      type: { type: 'string', enum: ['text', 'paragraph', 'h1', 'h2', 'h3', 'h4', 'h5'] },
      textType: { type: 'string', enum: ['secondary', 'success', 'warning', 'danger'] },
      ellipsis: { type: 'boolean' },
      copyable: { type: 'boolean' },
      editable: { type: 'boolean' },
      underline: { type: 'boolean' },
      strong: { type: 'boolean' },
      italic: { type: 'boolean' },
      code: { type: 'boolean' },
      mark: { type: 'boolean' },
    }),
    usage: '用于页面标题、说明和静态文本。',
    constraints: [],
  },
);

const manifests = [
  containerManifest,
  formManifest,
  inputManifest,
  selectManifest,
  switchManifest,
  buttonManifest,
  tableManifest,
  textManifest,
] as const;

export const antdMaterialManifest: MaterialManifestCatalog = {
  formatVersion: MATERIAL_MANIFEST_FORMAT_VERSION,
  materialSet: {
    id: 'official-antd',
    version: '1.0.0',
  },
  materials: manifests,
};

export const antdAgentMaterialCatalog = manifests.map(toAgentMaterialSummary);

export const antdValidationMaterialRegistry = Object.fromEntries(
  manifests.map((manifest) => [manifest.type, toValidationMaterialManifest(manifest)]),
) as Readonly<Record<string, ReturnType<typeof toValidationMaterialManifest>>>;

export function getAntdMaterialManifests(types: readonly string[]) {
  const requestedTypes = new Set(types);
  return manifests.filter((manifest) => requestedTypes.has(manifest.type));
}

export default antdMaterialManifest;
