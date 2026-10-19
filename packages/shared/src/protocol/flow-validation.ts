import type { PageFlow } from './flow.ts';
import { isFlowNodeProps } from './flow-node.ts';

export interface FlowSemanticError {
  code:
    | 'INVALID_FLOW_START'
    | 'INVALID_FLOW_NODE'
    | 'INVALID_FLOW_EDGE'
    | 'FLOW_CYCLE'
    | 'INVALID_FLOW_BRANCH';
  path: string;
  message: string;
}

export const flowPointer = (key: string): string => key.replaceAll('~', '~0').replaceAll('/', '~1');

/** Structural graph safety applies to retained drafts too; disconnected nodes are allowed. */
export const validateFlowSemantics = (flow: PageFlow, path: string): FlowSemanticError[] => {
  const errors: FlowSemanticError[] = [];
  const report = (code: FlowSemanticError['code'], at: string, message: string): void => {
    errors.push({ code, path: at, message });
  };
  const nodes = Object.values(flow.nodes);
  if (
    !Object.hasOwn(flow.nodes, flow.startId) ||
    flow.nodes[flow.startId]?.type !== 'start' ||
    nodes.filter((node) => node.type === 'start').length !== 1
  )
    report(
      'INVALID_FLOW_START',
      `${path}/startId`,
      'Flow must have exactly one start node identified by startId',
    );

  const incoming = new Map(nodes.map((node) => [node.id, [] as string[]]));
  for (const [id, node] of Object.entries(flow.nodes)) {
    const at = `${path}/nodes/${flowPointer(id)}`;
    if (node.id !== id)
      report('INVALID_FLOW_NODE', `${at}/id`, 'Node ID must match its dictionary key');
    if (node.type === 'start' && node.prev.length)
      report('INVALID_FLOW_START', `${at}/prev`, 'Start node cannot have incoming edges');
    for (const next of node.next) {
      if (!Object.hasOwn(flow.nodes, next))
        report('INVALID_FLOW_EDGE', `${at}/next`, `Edge references missing node ${next}`);
      else incoming.get(next)?.push(id);
    }
    if (node.type === 'condition' && isFlowNodeProps('condition', node.props)) {
      const branches = node.props.condition ?? [];
      const destinations = branches.map((branch) => branch.nextNode).sort();
      if (
        new Set(branches.map((branch) => branch.value)).size !== branches.length ||
        JSON.stringify(destinations) !== JSON.stringify([...node.next].sort())
      )
        report(
          'INVALID_FLOW_BRANCH',
          `${at}/props/condition`,
          'Condition branches must be unique and match next edges',
        );
    }
  }
  for (const [id, node] of Object.entries(flow.nodes)) {
    if (
      JSON.stringify([...(incoming.get(id) ?? [])].sort()) !== JSON.stringify([...node.prev].sort())
    )
      report(
        'INVALID_FLOW_EDGE',
        `${path}/nodes/${flowPointer(id)}/prev`,
        'prev and next edges must agree',
      );
  }

  // Kahn traversal checks disconnected components without recursively walking untrusted graphs.
  const indegree = new Map(
    Object.keys(flow.nodes).map((id) => [id, incoming.get(id)?.length ?? 0]),
  );
  const ready = [...indegree].filter(([, degree]) => degree === 0).map(([id]) => id);
  for (let index = 0; index < ready.length; index += 1) {
    for (const next of flow.nodes[ready[index]!]!.next) {
      if (!indegree.has(next)) continue;
      const degree = indegree.get(next)! - 1;
      indegree.set(next, degree);
      if (degree === 0) ready.push(next);
    }
  }
  if (ready.length !== nodes.length)
    report('FLOW_CYCLE', `${path}/nodes`, 'Event flows cannot contain cycles');
  return errors;
};
