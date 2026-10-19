import type LogicFlow from '@logicflow/core';
import type { Flow, Schema } from '@tangramino/engine';
import { getNodeDefinition } from './nodes/definitions';

export interface EventTarget {
  elementId: string;
  event: string;
  label: string;
}

export { nodeKinds } from './nodes/definitions';

interface EventGraph {
  nodes: LogicFlow.NodeData[];
  edges: (LogicFlow.EdgeConfig & { id: string; type: string })[];
}

// Agent flows carry executable edges, not canvas coordinates. Arrange their DAG by depth.
const flowPositions = (flow: Flow): Map<string, { x: number; y: number }> => {
  const depths = new Map(Object.keys(flow.nodes).map((id) => [id, 0]));
  const incoming = new Map(Object.keys(flow.nodes).map((id) => [id, 0]));
  for (const node of Object.values(flow.nodes))
    for (const next of node.next)
      if (incoming.has(next)) incoming.set(next, incoming.get(next)! + 1);
  const ready = [...incoming].filter(([, count]) => !count).map(([id]) => id);
  for (let index = 0; index < ready.length; index += 1) {
    const id = ready[index]!;
    for (const next of flow.nodes[id]!.next) {
      if (!incoming.has(next)) continue;
      depths.set(next, Math.max(depths.get(next)!, depths.get(id)! + 1));
      incoming.set(next, incoming.get(next)! - 1);
      if (!incoming.get(next)) ready.push(next);
    }
  }
  const rows = new Map<number, number>();
  return new Map(
    Object.keys(flow.nodes).map((id) => {
      const depth = depths.get(id)!;
      const row = rows.get(depth) ?? 0;
      rows.set(depth, row + 1);
      return [id, { x: 220 + depth * 240, y: 180 + row * 140 }];
    }),
  );
};

export const readGraph = (schema: Schema, target: EventTarget): EventGraph => {
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
  if (flow) {
    const positions = flowPositions(flow);
    return {
      nodes: Object.values(flow.nodes).map((node) => ({
        id: node.id,
        type: node.type,
        x: retained?.nodes?.find((item) => item.id === node.id)?.x ?? positions.get(node.id)!.x,
        y: retained?.nodes?.find((item) => item.id === node.id)?.y ?? positions.get(node.id)!.y,
        properties: node.props,
      })),
      edges: Object.values(flow.nodes).flatMap((node) =>
        node.next.map((id, index) => ({
          id: `${node.id}-${id}-${index}`,
          type: 'polyline',
          sourceNodeId: node.id,
          targetNodeId: id,
          ...(node.type === 'condition'
            ? (() => {
                const condition = Array.isArray(node.props.condition)
                  ? (node.props.condition as { value: boolean; nextNode: string }[])
                  : [];
                const branch =
                  condition.filter((item) => item.nextNode === id)[
                    node.next.slice(0, index).filter((nextId) => nextId === id).length
                  ]?.value === false
                    ? 'false'
                    : 'true';
                return { sourceAnchorId: `${node.id}_${branch}`, properties: { branch } };
              })()
            : {}),
        })),
      ),
    };
  }
  return {
    nodes: [{ id: 'start', type: 'start', x: 200, y: 180, properties: { title: target.label } }],
    edges: [],
  };
};

// Engine traverses recursively: reject cycles before committing a graph.
export const toFlow = (graph: EventGraph): Flow => {
  const start = graph.nodes.find((node) => node.type === 'start');
  if (!start || graph.nodes.filter((node) => node.type === 'start').length !== 1)
    throw new Error('流程必须保留一个开始节点');
  const nodes: Flow['nodes'] = Object.fromEntries(
    graph.nodes.map((node) => {
      // LogicFlow adds presentation dimensions to properties; keep them only in flowGraph.
      const { width: _width, height: _height, ...properties } = node.properties ?? {};
      return [
        node.id,
        {
          id: node.id,
          type: node.type,
          props: properties,
          prev: [],
          next: [],
        },
      ];
    }),
  );
  for (const node of Object.values(nodes)) {
    if (node.type === 'condition') node.props = { ...node.props, condition: [] };
  }
  for (const edge of graph.edges) {
    const source = nodes[edge.sourceNodeId];
    const target = nodes[edge.targetNodeId];
    if (!source || !target) throw new Error('连线指向了不存在的节点');
    if (getNodeDefinition(target.type)?.connections.acceptsInput === false)
      throw new Error('开始节点不能有输入连线');
    if (source.type === 'condition') {
      const branches = source.props.condition as { value: boolean; nextNode: string }[];
      const branch =
        edge.properties?.branch ??
        (edge.sourceAnchorId?.endsWith('_false')
          ? 'false'
          : edge.sourceAnchorId?.endsWith('_true')
            ? 'true'
            : branches.some((item) => item.value)
              ? 'false'
              : 'true');
      if (branch !== 'true' && branch !== 'false') throw new Error('条件连线必须属于真或假分支');
      const value = branch === 'true';
      if (branches.length >= 2 || branches.some((item) => item.value === value))
        throw new Error('条件节点的真、假分支各只能连接一个节点');
      branches.push({ value, nextNode: target.id });
    }
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
