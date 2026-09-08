import {
  MATERIAL_MANIFEST_FORMAT_VERSION,
  toAgentMaterialSummary,
  toValidationMaterialManifest,
  type JsonSchema,
  type MaterialManifest,
  type MaterialManifestCatalog,
} from '@/material-manifest';

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

const emptyContext: MaterialManifest['context'] = { variables: [], values: [], methods: [] };
const inputContext: MaterialManifest['context'] = {
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
const optionsSchema: JsonSchema = { type: 'array', items: optionSchema };

function defineSimpleManifest(
  core: MaterialCore,
  details: Omit<ManifestDetails, 'version'>,
): MaterialManifest {
  return defineManifest(core, { version: '1.0.0', ...details });
}

export const checkboxManifest = defineSimpleManifest(
  {
    type: 'checkbox',
    title: '复选框',
    defaultProps: {
      options: [
        { label: '选项1', value: '选项1' },
        { label: '选项2', value: '选项2' },
      ],
    },
    context: {
      ...inputContext,
      variables: [...inputContext.variables, { name: 'options', description: '选项' }],
    },
  },
  {
    description: '从一组选项中选择零个或多个值。',
    keywords: ['复选框', '多选', '选项'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    propsSchema: objectSchema({ options: optionsSchema }),
    usage: '用于多选字段。',
    constraints: ['必须置于 form 中。'],
  },
);

export const radioManifest = defineSimpleManifest(
  {
    type: 'radio',
    title: '单选框',
    defaultProps: {
      options: [
        { label: '选项一', value: 'option1' },
        { label: '选项二', value: 'option2' },
      ],
    },
    context: {
      ...inputContext,
      variables: [...inputContext.variables, { name: 'options', description: '选项' }],
    },
  },
  {
    description: '从一组选项中选择一个值。',
    keywords: ['单选框', '单选', '选项'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    propsSchema: objectSchema({ options: optionsSchema, optionDisplayButton: { type: 'boolean' } }),
    usage: '用于互斥选择字段。',
    constraints: ['必须置于 form 中。'],
  },
);

export const numberManifest = defineSimpleManifest(
  {
    type: 'number',
    title: '数字框',
    defaultProps: { placeholder: '请输入', size: 'middle' },
    context: {
      ...inputContext,
      methods: [
        ...inputContext.methods,
        {
          name: 'onPressEnter',
          description: '回车的回调',
          params: [{ description: '事件参数' }],
        },
      ],
    },
  },
  {
    description: '录入带范围和精度约束的数值。',
    keywords: ['数字框', '数值', '金额'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    propsSchema: objectSchema({
      defaultValue: { type: 'number' },
      min: { type: 'number' },
      max: { type: 'number' },
      precision: { type: 'number', minimum: 0, maximum: 10 },
      prefix: { type: 'string' },
      suffix: { type: 'string' },
      addonBefore: { type: 'string' },
      addonAfter: { type: 'string' },
      placeholder: { type: 'string' },
      allowClear: { type: 'boolean' },
      size: { type: 'string', enum: ['large', 'middle', 'small'] },
    }),
    usage: '用于数量、金额、比例等数值字段。',
    constraints: ['必须置于 form 中。', 'min 不应大于 max。'],
  },
);

export const textareaManifest = defineSimpleManifest(
  {
    type: 'textarea',
    title: '文本域',
    defaultProps: { placeholder: '请输入内容', size: 'middle' },
    context: {
      ...inputContext,
      methods: [
        ...inputContext.methods,
        { name: 'onPressEnter', description: '回车的回调', params: [{ description: '事件参数' }] },
      ],
    },
  },
  {
    description: '录入多行文本。',
    keywords: ['文本域', '多行文本', '备注'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    propsSchema: objectSchema({
      maxLength: { type: 'number', minimum: 0 },
      showCount: { type: 'boolean' },
      placeholder: { type: 'string' },
      autoSize: { type: ['boolean', 'object'] },
      size: { type: 'string', enum: ['large', 'middle', 'small'] },
    }),
    usage: '用于描述、备注等多行字段。',
    constraints: ['必须置于 form 中。'],
  },
);

function dateInputManifest(
  type: 'datePicker' | 'datePickerRange' | 'timePicker',
  title: string,
  props: Readonly<Record<string, JsonSchema>>,
): MaterialManifest {
  return defineSimpleManifest(
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
}

export const datePickerManifest = dateInputManifest('datePicker', '日期选择器', {
  format: { type: 'string' },
  picker: { type: 'string', enum: ['date', 'week', 'month', 'quarter', 'year'] },
  placeholder: { type: 'string' },
  allowClear: { type: 'boolean' },
});
export const datePickerRangeManifest = dateInputManifest('datePickerRange', '日期范围选择器', {
  format: { type: 'string' },
  placeholder: { type: 'string' },
  showNow: { type: 'boolean' },
  allowClear: { type: 'boolean' },
});
export const timePickerManifest = dateInputManifest('timePicker', '时间选择器', {
  format: { type: 'string', enum: ['HH:mm:ss', 'HH:mm'] },
  placeholder: { type: 'string' },
  allowClear: { type: 'boolean' },
});

function optionInputManifest(
  type: 'cascader' | 'treeSelect',
  title: string,
  variableName: 'options' | 'treeData',
): MaterialManifest {
  return defineSimpleManifest(
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
}

export const cascaderManifest = optionInputManifest('cascader', '级联选择', 'options');
export const treeSelectManifest = optionInputManifest('treeSelect', '树选择器', 'treeData');

export const sliderManifest = defineSimpleManifest(
  {
    type: 'slider',
    title: '滑动输入条',
    defaultProps: {},
    context: {
      variables: [
        { name: 'checked', description: '是否选中' },
        { name: 'disabled', description: '是否禁用' },
      ],
      values: [],
      methods: inputContext.methods,
    },
  },
  {
    description: '通过滑动在数值范围内选值。',
    keywords: ['滑块', '数值', '范围'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    propsSchema: objectSchema({ min: { type: 'number' }, max: { type: 'number' } }),
    usage: '用于直观调整数值。',
    constraints: ['必须置于 form 中。', 'min 不应大于 max。'],
  },
);

export const uploadManifest = defineSimpleManifest(
  { type: 'upload', title: '上传', defaultProps: {}, context: emptyContext },
  {
    description: '选择并上传文件。',
    keywords: ['上传', '文件', '图片'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    propsSchema: objectSchema({
      listType: { type: 'string', enum: ['text', 'picture', 'picture-card'] },
      maxCount: { type: 'number', minimum: 1 },
      multiple: { type: 'boolean' },
      disabled: { type: 'boolean' },
      drag: { type: 'boolean' },
      showUploadList: { type: 'boolean' },
      accept: { type: 'string' },
      action: { type: 'string' },
      headers: { type: 'object' },
      data: { type: 'object' },
      name: { type: 'string' },
      withCredentials: { type: 'boolean' },
    }),
    usage: '用于表单中的文件提交。',
    constraints: ['必须置于 form 中。', '上传地址必须使用安全 URL。'],
  },
);

function overlayManifest(type: 'modal' | 'drawer', title: string): MaterialManifest {
  return defineSimpleManifest(
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
}

export const modalManifest = overlayManifest('modal', '弹窗容器');
export const drawerManifest = overlayManifest('drawer', '抽屉容器');

export const treeManifest = defineSimpleManifest(
  {
    type: 'tree',
    title: '树',
    defaultProps: {
      treeData: [
        {
          title: '节点1',
          key: '0-0',
          children: [
            { title: '子节点1', key: '0-0-0' },
            { title: '子节点2', key: '0-0-1' },
          ],
        },
        { title: '节点2', key: '0-1' },
      ],
    },
    context: {
      variables: [
        { name: 'treeData', description: '树节点数据' },
        { name: 'selectedKeys', description: '选中节点键数组' },
        { name: 'checkedKeys', description: '勾选节点键数组' },
      ],
      values: [],
      methods: [
        { name: 'onSelect', description: '节点选中时触发的回调' },
        { name: 'onCheck', description: '节点勾选时触发的回调' },
      ],
    },
  },
  {
    description: '展示层级树形数据。',
    keywords: ['树', '层级', '目录'],
    role: 'display',
    acceptsChildren: false,
    propsSchema: objectSchema({
      treeData: { type: 'array', items: { type: 'object' } },
      checkable: { type: 'boolean' },
      multiple: { type: 'boolean' },
      defaultExpandAll: { type: 'boolean' },
      checkStrictly: { type: 'boolean' },
      showLine: { type: 'boolean' },
      draggable: { type: 'boolean' },
    }),
    usage: '用于目录、组织或分类层级。',
    constraints: ['每个节点应具有唯一 key。'],
  },
);

const manifests = [
  containerManifest,
  formManifest,
  inputManifest,
  numberManifest,
  checkboxManifest,
  radioManifest,
  selectManifest,
  textareaManifest,
  datePickerManifest,
  datePickerRangeManifest,
  timePickerManifest,
  switchManifest,
  treeSelectManifest,
  cascaderManifest,
  sliderManifest,
  uploadManifest,
  buttonManifest,
  modalManifest,
  drawerManifest,
  tableManifest,
  textManifest,
  treeManifest,
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
