import type { RuntimeObserver } from '../observation';
import type { LogicNodes, RuntimeEngine, RuntimeSchema } from './types';

export const withFlowEngine = ({
  engine,
  schema,
  logicNodes,
  onError,
  observer,
}: {
  engine: RuntimeEngine;
  schema: RuntimeSchema;
  logicNodes: LogicNodes;
  observer?: RuntimeObserver;
  onError?: (error: unknown) => void;
}): void => {
  for (const binding of schema.bindElements) {
    const flow = schema.flows[binding.flowId];
    if (!flow) throw new Error(`流程不存在：${binding.flowId}`);

    engine.injectCallback(binding.id, binding.event, () => {
      if (engine.disposed) return;
      const signal = engine.signal;
      const executionId = observer?.nextExecution();
      const started = executionId === undefined ? 0 : performance.now();
      const observeFlow = (status: 'started' | 'completed' | 'failed' | 'cancelled') => {
        if (executionId !== undefined)
          observer?.emit({
            kind: 'flow',
            executionId,
            flowId: binding.flowId,
            elementId: binding.id,
            status,
            durationMs: status === 'started' ? 0 : performance.now() - started,
          });
      };
      let finished = false;
      const finish = (status: 'completed' | 'failed' | 'cancelled') => {
        if (finished) return;
        finished = true;
        signal.removeEventListener('abort', cancel);
        observeFlow(status);
      };
      const cancel = () => finish('cancelled');
      if (executionId !== undefined) signal.addEventListener('abort', cancel, { once: true });
      observeFlow('started');
      const values: Record<string, unknown> = {};
      const execute = async (id: string, path: ReadonlySet<string>): Promise<void> => {
        if (signal.aborted || engine.disposed) return;
        const node = flow.nodes[id];
        // Invoke synchronously up to the first await so the start node captures this event.
        const nodeStarted = executionId === undefined ? 0 : performance.now();
        let result: unknown;
        try {
          if (path.has(id)) throw new Error('流程包含循环连接');
          if (!node) throw new Error(`流程节点不存在：${id}`);
          const handler = logicNodes[node.type];
          if (!handler) throw new Error(`未知流程节点：${node.type}`);
          result = await handler({
            data: node.props,
            engine,
            lastReturnedVal: values,
            signal,
            observeRequest:
              executionId === undefined
                ? undefined
                : (record) => {
                    observer?.emit({ ...record, kind: 'request', executionId, nodeId: id });
                  },
          });
        } catch (error) {
          if (executionId !== undefined && !signal.aborted)
            observer?.emit({
              kind: 'node',
              executionId,
              nodeId: id,
              status: 'failed',
              code: 'NODE_EXECUTION_ERROR',
              durationMs: performance.now() - nodeStarted,
            });
          throw error;
        }
        if (executionId !== undefined && !signal.aborted)
          observer?.emit({
            kind: 'node',
            executionId,
            nodeId: id,
            status: 'completed',
            durationMs: performance.now() - nodeStarted,
          });
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
      void promise
        .then(
          () => finish(signal.aborted ? 'cancelled' : 'completed'),
          (error: unknown) => {
            finish(signal.aborted ? 'cancelled' : 'failed');
            if (!signal.aborted) onError?.(error);
          },
        )
        .catch(() => {
          // The original promise still delivers the original failure to its caller.
        });

      return promise;
    });
  }
};
