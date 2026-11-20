export type RuntimeObservationData =
  | { kind: 'render'; status: 'ready' | 'degraded' | 'failed'; durationMs: number }
  | {
      kind: 'flow';
      executionId: number;
      flowId: string;
      elementId: string;
      status: 'started' | 'completed' | 'failed' | 'cancelled';
      durationMs: number;
    }
  | {
      kind: 'node';
      executionId: number;
      nodeId: string;
      status: 'completed' | 'failed';
      durationMs: number;
      code?: 'NODE_EXECUTION_ERROR';
    }
  | {
      kind: 'request';
      executionId: number;
      nodeId: string;
      status:
        | 'completed'
        | 'http_error'
        | 'timeout'
        | 'network_error'
        | 'configuration_error'
        | 'cancelled';
      durationMs: number;
      method?: string;
      statusCode?: number;
    };

export type RuntimeObservation = RuntimeObservationData & {
  version: 1;
  runtimeSessionId: string;
  sequence: number;
};

export const createObservation = (sink: (record: RuntimeObservation) => void) => {
  let sequence = 0;
  let executionId = 0;
  let scheduled = false;
  let queue: RuntimeObservation[] = [];
  const runtimeSessionId =
    globalThis.crypto.randomUUID?.() ??
    Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
  return {
    nextExecution: () => ++executionId,
    emit: (data: RuntimeObservationData) => {
      if ('flowId' in data && (data.flowId.length > 128 || data.elementId.length > 128)) return;
      if ('nodeId' in data && data.nodeId.length > 128) return;
      const record = { ...data, version: 1 as const, runtimeSessionId, sequence: ++sequence };
      if (queue.length >= 256) {
        if (data.status === 'completed' || data.status === 'started') return;
        const index = queue.findIndex((entry) => entry.status === 'completed');
        queue.splice(Math.max(0, index), 1);
      }
      queue.push(record);
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        const records = queue;
        queue = [];
        scheduled = false;
        for (const entry of records) {
          try {
            sink(entry);
          } catch {
            // Observation failures cannot affect page execution.
          }
        }
      });
    },
  };
};

export type RuntimeObserver = ReturnType<typeof createObservation>;
