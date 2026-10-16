import { Type, type Static, type TProperties, type TSchema } from '@sinclair/typebox';

export const FLOW_NODE_MANIFEST_VERSION = '1.0' as const;

/** References resolve the whole configured value; nested JSON strings are never evaluated. */
export const FlowValueReferenceSchema = Type.Object(
  {
    $ref: Type.Union([Type.Literal('global'), Type.Literal('result')]),
    name: Type.String({ minLength: 1, description: '全局变量名称，或返回值来源节点的 ID。' }),
    path: Type.Optional(Type.String({ description: '点分隔的数据路径，例如 data.items。' })),
  },
  { additionalProperties: false },
);
export type FlowValueReference = Static<typeof FlowValueReferenceSchema>;

export interface FlowNodeManifest {
  type: string;
  title: string;
  description: string;
  executable: boolean;
  /** Initial editor drafts may have empty targets; they are not executable examples. */
  defaultProps: Readonly<Record<string, unknown>>;
  propsSchema: TSchema;
  returnsSchema?: TSchema;
  connections: Readonly<{
    acceptsInput: boolean;
    outputs: readonly ('next' | 'true' | 'false')[];
  }>;
  constraints: readonly string[];
}

const value = (description: string) =>
  Type.Unknown({
    description: `${description} 支持 JSON 值，或完整的 global/result 数据引用；不执行表达式。`,
  });
const withReference = (schema: TSchema, description: string) =>
  Type.Union([schema, FlowValueReferenceSchema], { description });
const props = <T extends TProperties>(properties: T) =>
  Type.Object(
    {
      title: Type.Optional(Type.String({ description: '逻辑节点的显示名称。' })),
      alias: Type.Optional(Type.String({ description: '兼容已有逻辑节点的显示别名。' })),
      ...properties,
    },
    { additionalProperties: false },
  );
const target = () =>
  Type.String({ description: '当前页面的真实元素 ID；执行前必须选择有效目标。' });
const sequence = { acceptsInput: true, outputs: ['next'] } as const;

export const flowNodeManifests = [
  {
    type: 'start',
    title: '开始',
    description: '事件触发后开始执行',
    executable: true,
    defaultProps: {},
    propsSchema: props({}),
    connections: { acceptsInput: false, outputs: ['next'] },
    constraints: ['每个流程恰好有一个开始节点，startId 指向它；开始节点不能有输入连线。'],
  },
  {
    type: 'interfaceRequest',
    title: '接口请求',
    description: '发送 HTTP 请求并返回响应数据',
    executable: true,
    defaultProps: {
      url: '',
      method: 'get',
      headers: {},
      queryParams: {},
      bodyParams: null,
      timeout: 10000,
    },
    propsSchema: props({
      url: withReference(
        Type.String(),
        '请求地址或数据引用；解析后必须为不含用户名或密码的 HTTP(S) 绝对地址。',
      ),
      method: Type.Union(
        ['get', 'post', 'put', 'patch', 'delete'].map((method) => Type.Literal(method)),
        { description: 'HTTP 请求方法。' },
      ),
      headers: withReference(
        Type.Record(Type.String(), Type.String()),
        '请求头对象或数据引用，各项值为字符串。',
      ),
      queryParams: withReference(
        Type.Record(Type.String(), Type.Unknown()),
        'URL 查询参数对象或数据引用。',
      ),
      bodyParams: value('JSON 请求体；GET 请求不发送请求体。'),
      timeout: Type.Number({ minimum: 100, maximum: 60000, description: '超时时间，单位毫秒。' }),
    }),
    returnsSchema: Type.Object(
      {
        ok: Type.Boolean(),
        status: Type.Number(),
        data: Type.Unknown(),
        error: Type.Union([Type.String(), Type.Null()]),
      },
      { additionalProperties: false },
    ),
    connections: sequence,
    constraints: [
      '不携带工作台凭据，不自动跟随重定向。',
      '失败也返回 { ok, status, data, error }，需要通过条件节点处理失败分支。',
    ],
  },
  {
    type: 'customJS',
    title: '自定义 JS',
    description: '保存自定义代码；当前暂不执行',
    executable: false,
    defaultProps: { code: '' },
    propsSchema: props({ code: Type.String({ description: '仅保存的代码配置，不执行。' }) }),
    connections: sequence,
    constraints: ['不能用于实现实际业务行为，也不能向用户声称代码已执行。'],
  },
  {
    type: 'setElementProps',
    title: '设置元素属性',
    description: '批量设置组件属性',
    executable: true,
    defaultProps: { setters: [{ elementId: '', propName: '', value: null }] },
    propsSchema: props({
      setters: Type.Array(
        Type.Object(
          {
            elementId: target(),
            propName: Type.String({ description: '目标物料允许设置的属性名。' }),
            value: value('属性值。'),
          },
          { additionalProperties: false },
        ),
      ),
    }),
    connections: sequence,
    constraints: [
      '目标元素必须存在，属性必须由目标物料声明；运行时状态修改不写回 Working Schema。',
    ],
  },
  {
    type: 'emitElementAction',
    title: '触发元素方法',
    description: '调用物料公开的方法',
    executable: true,
    defaultProps: { setters: [{ elementId: '', methodName: '', value: [] }] },
    propsSchema: props({
      setters: Type.Array(
        Type.Object(
          {
            elementId: target(),
            methodName: Type.String({
              description: '物料公开的上下文方法名，不是 onClick 等事件名。',
            }),
            value: value('调用参数；数组按位置展开，其他值作为单个参数。'),
          },
          { additionalProperties: false },
        ),
      ),
    }),
    returnsSchema: Type.Array(
      Type.Union([
        Type.Object({ status: Type.Literal('fulfilled'), value: Type.Unknown() }),
        Type.Object({ status: Type.Literal('rejected'), reason: Type.Unknown() }),
      ]),
    ),
    connections: sequence,
    constraints: ['只能调用目标物料公开的上下文方法；返回有效方法调用的 Promise.allSettled 结果。'],
  },
  {
    type: 'visibleElement',
    title: '显隐元素',
    description: '显示或隐藏多个页面组件',
    executable: true,
    defaultProps: { elementIds: [], value: true },
    propsSchema: props({
      elementIds: Type.Array(target()),
      value: withReference(
        Type.Boolean(),
        '是否显示或数据引用；解析结果为 false 时隐藏，否则显示。',
      ),
    }),
    connections: sequence,
    constraints: ['目标必须属于当前页面。'],
  },
  {
    type: 'condition',
    title: '条件判断',
    description: '根据条件分别执行真、假分支',
    executable: true,
    defaultProps: { judgment: true, operator: 'truthy', compareValue: null },
    propsSchema: props({
      judgment: value('判断值。'),
      operator: Type.Union(
        ['truthy', 'equals', 'notEquals', 'greater', 'less'].map((operator) =>
          Type.Literal(operator),
        ),
        {
          description:
            'truthy 判断真假；equals/notEquals 按 JSON 序列化结果比较；greater/less 只比较数字。',
        },
      ),
      compareValue: value('比较值，truthy 模式下忽略。'),
      condition: Type.Optional(
        Type.Array(
          Type.Object(
            { value: Type.Boolean(), nextNode: Type.String({ minLength: 1 }) },
            { additionalProperties: false },
          ),
          { maxItems: 2, description: '执行流程中的真/假分支映射，由连线生成。' },
        ),
      ),
    }),
    returnsSchema: Type.Boolean(),
    connections: { acceptsInput: true, outputs: ['true', 'false'] },
    constraints: ['真、假分支各最多连接一个后续节点；映射中的 nextNode 必须与节点 next 连线一致。'],
  },
  {
    type: 'setGlobalVariable',
    title: '设置全局变量',
    description: '批量更新页面中的全局变量',
    executable: true,
    defaultProps: { setters: [{ name: '', value: null }] },
    propsSchema: props({
      setters: Type.Array(
        Type.Object(
          {
            name: Type.String({ description: '当前页面已声明的全局变量名称。' }),
            value: value('变量的新值。'),
          },
          { additionalProperties: false },
        ),
      ),
    }),
    connections: sequence,
    constraints: ['变量必须在当前页面 context.globalVariables 中声明；只修改运行时变量。'],
  },
  ...(['openModalDrawer', 'closeModalDrawer'] as const).map((type) => ({
    type,
    title: type === 'openModalDrawer' ? '打开弹窗抽屉' : '关闭弹窗抽屉',
    description: type === 'openModalDrawer' ? '打开页面中的弹窗或抽屉' : '关闭页面中的弹窗或抽屉',
    executable: true,
    defaultProps: { elementId: '' },
    propsSchema: props({ elementId: target() }),
    connections: sequence,
    constraints: ['目标元素必须属于当前页面，且物料 type 为 modal 或 drawer。'],
  })),
] as const satisfies readonly FlowNodeManifest[];

export type FlowNodeType = (typeof flowNodeManifests)[number]['type'];

export const flowNodeManifestCatalog = {
  formatVersion: FLOW_NODE_MANIFEST_VERSION,
  nodes: flowNodeManifests,
} as const;

export const getFlowNodeManifest = (type: string): FlowNodeManifest | undefined =>
  flowNodeManifests.find((node) => node.type === type);
