import {
  SCHEMA_VERSION,
  type BlockDefinition,
  type PageFlow,
  type PageFlowNode,
} from '@origamix/shared';

const fn = (body: string, params: Record<string, string> = {}) => ({
  type: 'function' as const,
  value: { body, params: Object.entries(params).map(([name, value]) => ({ name, value })) },
});
const flow = (steps: { type: string; props: Record<string, unknown> }[]): PageFlow => {
  const all = [{ type: 'start', props: {} }, ...steps];
  return {
    startId: 'n0',
    nodes: Object.fromEntries(
      all.map((step, i): [string, PageFlowNode] => [
        `n${i}`,
        {
          id: `n${i}`,
          ...step,
          prev: i ? [`n${i - 1}`] : [],
          next: i < all.length - 1 ? [`n${i + 1}`] : [],
        },
      ]),
    ),
  };
};
const request = (method: 'post' | 'get', body: string, params: Record<string, string>) => ({
  type: 'interfaceRequest',
  props: {
    url: { type: 'string', value: '' },
    method,
    headers: fn("return { 'Content-Type': 'application/json' };"),
    queryParams: fn(method === 'get' ? body : 'return {};', method === 'get' ? params : {}),
    bodyParams: fn(method === 'post' ? body : 'return null;', method === 'post' ? params : {}),
  },
});
const shell = (
  elements: BlockDefinition['schema']['elements'],
  structure: Record<string, string[]>,
  flows: Record<string, PageFlow>,
  bindElements: BlockDefinition['schema']['bindElements'],
): BlockDefinition['schema'] => ({
  elements,
  layout: { root: 'root', structure },
  flows,
  bindElements,
  context: { globalVariables: [] },
  extensions: { origamix: { schemaVersion: SCHEMA_VERSION } },
});
const endpoint = (flowIds: string[], nodeId: string) => [
  {
    name: 'endpoint',
    label: '接口地址（返回 JSON）',
    paths: flowIds.map((id) => ['flows', id, 'nodes', nodeId, 'props', 'url', 'value']),
  },
];
const status = (nodeId: string) => ({
  type: 'setElementProps',
  props: {
    setters: [
      {
        elementId: 'status',
        propName: 'text',
        value: fn("return response.ok ? '请求成功' : (response.error || '请求失败，请重试');", {
          response: `result.${nodeId}`,
        }),
      },
    ],
  },
});

const definitions: readonly BlockDefinition[] = [
  {
    id: 'login-form',
    title: '登录表单',
    description: '账号密码表单与接口请求；通过事件流设置应用状态并跳转页面。',
    parameters: endpoint(['login'], 'n2'),
    schema: shell(
      {
        root: { type: 'form', props: { layout: 'vertical', alias: '登录表单' } },
        account: {
          type: 'input',
          props: {
            fieldName: 'username',
            fieldLabel: '账号',
            fieldRequired: true,
            placeholder: '请输入账号',
            layoutWidth: 'fill',
          },
        },
        password: {
          type: 'input',
          props: {
            fieldName: 'password',
            fieldLabel: '密码',
            fieldRequired: true,
            type: 'password',
            placeholder: '请输入密码',
            layoutWidth: 'fill',
          },
        },
        submit: { type: 'button', props: { text: '登录', type: 'primary' } },
        status: { type: 'text', props: { text: '请填写账号和密码' } },
      },
      { root: ['account', 'password', 'submit', 'status'] },
      {
        login: flow([
          {
            type: 'customJS',
            props: { value: fn('return validate();', { validate: 'method.root.validateFields' }) },
          },
          request('post', 'return values;', { values: 'result.n1' }),
          status('n2'),
        ]),
      },
      [{ id: 'submit', event: 'onClick', flowId: 'login' }],
    ),
  },
  {
    id: 'search-table',
    title: '搜索表格',
    description:
      '搜索、重置及服务端分页。接口参数 keyword/page/pageSize，响应为 { items, total }。',
    parameters: endpoint(['search', 'reset', 'paginate'], 'n2'),
    schema: shell(
      {
        root: {
          type: 'container',
          props: {
            heightConfig: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            alias: '搜索表格',
          },
        },
        form: { type: 'form', props: { layout: 'inline' } },
        keyword: {
          type: 'input',
          props: { fieldName: 'keyword', fieldLabel: '关键词', placeholder: '搜索关键词' },
        },
        search: { type: 'button', props: { text: '搜索', type: 'primary' } },
        reset: { type: 'button', props: { text: '重置' } },
        table: {
          type: 'table',
          props: {
            rowKey: 'id',
            columns: [{ title: '名称', dataIndex: 'name' }],
            paginationMode: 'remote',
            pagination: { current: 1, pageSize: 10, total: 0 },
          },
        },
        status: { type: 'text', props: { text: '点击搜索加载数据' } },
      },
      { root: ['form', 'table', 'status'], form: ['keyword', 'search', 'reset'] },
      Object.fromEntries(
        ['search', 'reset', 'paginate'].map((kind) => [
          kind,
          flow([
            {
              type: 'customJS',
              props: {
                value:
                  kind === 'reset'
                    ? fn('return reset();', { reset: 'method.form.resetFields' })
                    : fn('return null;'),
              },
            },
            request(
              'get',
              kind === 'paginate'
                ? 'return { ...values, page: event.pagination.current, pageSize: event.pagination.pageSize };'
                : 'return { ...values, page: 1, pageSize: size };',
              kind === 'paginate'
                ? { values: 'state.form.value', event: 'event.payload' }
                : { values: 'state.form.value', size: 'state.table.pagination.pageSize' },
            ),
            {
              type: 'condition',
              props: {
                judgment: fn('return response.ok;', { response: 'result.n2' }),
                condition: [
                  { value: true, nextNode: 'n4' },
                  { value: false, nextNode: 'failure' },
                ],
              },
            },
            {
              type: 'setElementProps',
              props: {
                setters: [
                  {
                    elementId: 'table',
                    propName: 'dataSource',
                    value: fn(
                      "if (!Array.isArray(response.data.items)) throw new Error('接口需返回 items 数组'); return response.data.items;",
                      { response: 'result.n2' },
                    ),
                  },
                  {
                    elementId: 'table',
                    propName: 'pagination',
                    value: fn(
                      kind === 'paginate'
                        ? 'return { current: event.pagination.current, pageSize: event.pagination.pageSize, total: response.data.total };'
                        : 'return { current: 1, pageSize: size, total: response.data.total };',
                      kind === 'paginate'
                        ? { response: 'result.n2', event: 'event.payload' }
                        : { response: 'result.n2', size: 'state.table.pagination.pageSize' },
                    ),
                  },
                ],
              },
            },
            status('n2'),
          ]),
        ]),
      ),
      [
        { id: 'search', event: 'onClick', flowId: 'search' },
        { id: 'reset', event: 'onClick', flowId: 'reset' },
        { id: 'table', event: 'onChange', flowId: 'paginate' },
      ],
    ),
  },
];
// The failure branch reports the error without replacing retained table data.
for (const pageFlow of Object.values(definitions[1]!.schema.flows)) {
  pageFlow.nodes.n3!.next.push('failure');
  pageFlow.nodes.failure = {
    id: 'failure',
    type: 'setElementProps',
    props: status('n2').props,
    prev: ['n3'],
    next: [],
  };
}

export const antdBlocks: readonly BlockDefinition[] = definitions;
