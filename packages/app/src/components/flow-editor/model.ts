import type LogicFlow from '@logicflow/core';
import type { Flow, Schema } from '@tangramino/engine';

export interface EventTarget {
  elementId: string;
  event: string;
  label: string;
}

export const nodeKinds = [
  { type: 'setElementProps', title: '设置元素属性', description: '更新组件的属性值' },
  { type: 'visibleElement', title: '设置元素显隐', description: '显示或隐藏页面组件' },
  { type: 'setGlobalVariable', title: '设置全局变量', description: '更新页面中的全局变量' },
] as const;

export const readGraph = (schema: Schema, target: EventTarget): LogicFlow.GraphData => {
  const graphs = schema.extensions.flowGraph as Record<string, LogicFlow.GraphData> | undefined;
  const retained = graphs?.[`${target.elementId}::${target.event}`];
  const binding = schema.bindElements?.find(
    (item) => item.id === target.elementId && item.event === target.event,
  );
  const flow = binding && schema.flows?.[binding.flowId];
  // Layout metadata must never override a flow changed by Agent or history.
  if (
    retained?.nodes?.every((node) => typeof node.x === 'number' && typeof node.y === 'number') &&
    flow
  ) {
    try {
      if (JSON.stringify(toFlow(retained)) === JSON.stringify(flow)) return retained;
    } catch {
      /* Reconstruct from the executable flow below. */
    }
  }
  if (flow)
    return {
      nodes: Object.values(flow.nodes).map((node, index) => ({
        id: node.id,
        type: node.type,
        x: retained?.nodes?.find((item) => item.id === node.id)?.x ?? 220 + index * 260,
        y: retained?.nodes?.find((item) => item.id === node.id)?.y ?? 180,
        properties: node.props,
      })),
      edges: Object.values(flow.nodes).flatMap((node) =>
        node.next.map((id) => ({
          id: `${node.id}-${id}`,
          type: 'polyline',
          sourceNodeId: node.id,
          targetNodeId: id,
          startPoint: { x: 0, y: 0 },
          endPoint: { x: 0, y: 0 },
        })),
      ),
    };
  return {
    nodes: [{ id: 'start', type: 'start', x: 200, y: 180, properties: { title: target.label } }],
    edges: [],
  };
};

// Engine traverses recursively: reject cycles before committing a graph.
export const toFlow = (graph: LogicFlow.GraphData): Flow => {
  const start = graph.nodes.find((node) => node.type === 'start');
  if (!start || graph.nodes.filter((node) => node.type === 'start').length !== 1)
    throw new Error('流程必须保留一个开始节点');
  const nodes: Flow['nodes'] = Object.fromEntries(
    graph.nodes.map((node) => [
      node.id,
      {
        id: node.id,
        type: node.type,
        props: node.properties ?? {},
        prev: [],
        next: [],
      },
    ]),
  );
  for (const edge of graph.edges) {
    const source = nodes[edge.sourceNodeId];
    const target = nodes[edge.targetNodeId];
    if (!source || !target) throw new Error('连线指向了不存在的节点');
    if (target.id === start.id) throw new Error('开始节点不能有输入连线');
    source.next.push(target.id);
    target.prev.push(source.id);
  }
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error('事件流程不能包含循环连线');
    if (visited.has(id)) return;
    visiting.add(id);
    nodes[id]!.next.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  };
  Object.keys(nodes).forEach(visit);
  return { startId: start.id, nodes };
};
