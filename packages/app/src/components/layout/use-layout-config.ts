import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { LayoutConfigState } from '@origamix/shared';
import type { EditorHandle } from '@origamix/editor';
import { layoutService } from '@/services/layout';
import { subscribeBackendReady } from '@/services/request';

export const useLayoutConfig = (
  projectId: string,
  active: boolean,
  editorRef: RefObject<EditorHandle | null>,
) => {
  const [value, setValue] = useState<{ projectId: string; config: LayoutConfigState } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const result = await layoutService.config(projectId);
    setValue({ projectId, config: result });
    setError(null);
  }, [projectId]);
  useEffect(() => {
    if (!active) return;
    let current = true;
    const load = () => {
      void layoutService
        .config(projectId)
        .then((config) => {
          if (current) {
            setValue({ projectId, config });
            setError(null);
          }
        })
        .catch((reason) => {
          if (current) setError(reason instanceof Error ? reason.message : '无法读取布局开关');
        });
    };
    load();
    const unsubscribe = subscribeBackendReady(load);
    return () => {
      current = false;
      unsubscribe();
    };
  }, [projectId, active]);
  const toggle = async (enabled: boolean): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await editorRef.current?.flush();
      const config = await layoutService.setEnabled(projectId, enabled);
      setValue({ projectId, config });
    } catch (reason) {
      try {
        await refresh();
      } catch {
        /* Re-read authority; never replay an uncertain toggle. */
      }
      setError(reason instanceof Error ? reason.message : '布局开关未确认，请重试读取');
    } finally {
      setBusy(false);
    }
  };
  return {
    config: value?.projectId === projectId ? value.config : null,
    error,
    busy,
    toggle,
    refresh,
  };
};
