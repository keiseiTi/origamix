export interface LogicNodeDefinition {
  type: string;
  title: string;
  description: string;
  defaultProps: Record<string, unknown>;
}

export const startNode: LogicNodeDefinition = {
  type: 'start',
  title: '开始',
  description: '事件触发后开始执行',
  defaultProps: {},
};

export const nodeKinds: LogicNodeDefinition[] = [
  {
    type: 'interfaceRequest',
    title: '接口请求',
    description: '发送 HTTP 请求并返回响应数据',
    defaultProps: {
      url: '',
      method: 'get',
      headers: {},
      queryParams: {},
      bodyParams: null,
      timeout: 10000,
    },
  },
  {
    type: 'customJS',
    title: '自定义 JS',
    description: '保存自定义代码；当前暂不执行',
    defaultProps: { code: '' },
  },
  {
    type: 'setElementProps',
    title: '设置元素属性',
    description: '批量设置组件属性',
    defaultProps: { setters: [{ elementId: '', propName: '', value: null }] },
  },
  {
    type: 'emitElementAction',
    title: '触发元素方法',
    description: '调用物料公开的方法',
    defaultProps: { setters: [{ elementId: '', methodName: '', value: [] }] },
  },
  {
    type: 'visibleElement',
    title: '显隐元素',
    description: '显示或隐藏多个页面组件',
    defaultProps: { elementIds: [], value: true },
  },
  {
    type: 'condition',
    title: '条件判断',
    description: '根据条件分别执行真、假分支',
    defaultProps: { judgment: true, operator: 'truthy', compareValue: null },
  },
  {
    type: 'setGlobalVariable',
    title: '设置全局变量',
    description: '批量更新页面中的全局变量',
    defaultProps: { setters: [{ name: '', value: null }] },
  },
  {
    type: 'openModalDrawer',
    title: '打开弹窗抽屉',
    description: '打开页面中的弹窗或抽屉',
    defaultProps: { elementId: '' },
  },
  {
    type: 'closeModalDrawer',
    title: '关闭弹窗抽屉',
    description: '关闭页面中的弹窗或抽屉',
    defaultProps: { elementId: '' },
  },
];

export const getNodeDefinition = (type: string): LogicNodeDefinition | undefined =>
  type === 'start' ? startNode : nodeKinds.find((node) => node.type === type);

export const defaultNodeProps = (type: string): Record<string, unknown> =>
  structuredClone(getNodeDefinition(type)?.defaultProps ?? {});
