// Flow dispatch adapted from Tangramino; see ../../NOTICE.
import type { LogicNodes, RuntimeEngine, RuntimeSchema } from './types';

export const withFlowEngine = ({
  engine,
  schema,
  logicNodes,
  onError,
}: {
  engine: RuntimeEngine;
  schema: RuntimeSchema;
  logicNodes: LogicNodes;
  onError?: (error: unknown) => void;
}): void => {
  for (const binding of schema.bindElements) {
    const flow = schema.flows[binding.flowId];
    if (!flow) throw new Error(`流程不存在：${binding.flowId}`);
    engine.injectCallback(binding.id, binding.event, () => {
      if (engine.disposed) return;
      const signal = engine.signal;
      const values: Record<string, unknown> = {};
      const execute = async (id: string, path: ReadonlySet<string>): Promise<void> => {
        if (signal.aborted || engine.disposed) return;
        if (path.has(id)) throw new Error('流程包含循环连接');
        const node = flow.nodes[id];
        if (!node) throw new Error(`流程节点不存在：${id}`);
        const handler = logicNodes[node.type];
        if (!handler) throw new Error(`未知流程节点：${node.type}`);
        // Invoke synchronously up to the first await so the start node captures this event.
        const result = await handler({ data: node.props, engine, lastReturnedVal: values, signal });
        if (signal.aborted || engine.disposed) return;
        values[id] = result;
        const next =
          node.type === 'condition'
            ? node.next.filter((nextId) =>
                (node.props.condition as { value: boolean; nextNode: string }[] | undefined)?.some(
                  (branch) => branch.value === result && branch.nextNode === nextId,
                ),
              )
            : node.next;
        const ancestors = new Set(path).add(id);
        for (const nextId of next) await execute(nextId, ancestors);
      };
      const promise = execute(flow.startId, new Set());
      // Consume rejections even when a material deliberately ignores the event return value.
      void promise.catch((error) => {
        if (!signal.aborted) onError?.(error);
      });
      return promise;
    });
  }
};
