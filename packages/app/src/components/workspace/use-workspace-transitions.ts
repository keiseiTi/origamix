import { useCallback, useRef, useState } from 'react';

export function useWorkspaceTransitions(flush: () => Promise<void>) {
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const transition = useCallback(
    async (action: () => void | Promise<void>): Promise<void> => {
      if (pending.current) return;
      pending.current = true;
      setError(null);
      try {
        await flush();
        await action();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '保存失败，请重试');
      } finally {
        pending.current = false;
      }
    },
    [flush],
  );

  return { transition, transitionError: error, setTransitionError: setError };
}
