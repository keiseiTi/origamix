import { useEffect, useState } from 'react';
import type { ApplicationMetadata } from '@origamix/shared';
import { projectsService } from '@/services/projects';
import { subscribeApplicationChanged } from '@/services/application-events';
export const useApplicationMetadata = (projectId: string, active: boolean) => {
  const [result, setResult] = useState<{
    projectId: string;
    value?: ApplicationMetadata;
    error?: string;
  }>();
  useEffect(() => {
    if (!active) return;
    let current = true;
    let sequence = 0;
    const load = () => {
      const identity = ++sequence;
      void projectsService
        .application(projectId)
        .then((state) => {
          if (current && sequence === identity)
            setResult({
              projectId,
              value:
                state.runtime === 'origamix'
                  ? {
                      pages: state.pages,
                      stateKeys: Object.keys(state.initialState),
                      ...(state.access.enabled ? { access: state.access } : {}),
                    }
                  : undefined,
            });
        })
        .catch((reason) => {
          if (current && sequence === identity)
            setResult({
              projectId,
              error: reason instanceof Error ? reason.message : '无法读取应用配置',
            });
        });
    };
    load();
    const unsubscribe = subscribeApplicationChanged(projectId, load);
    return () => {
      current = false;
      unsubscribe();
    };
  }, [projectId, active]);
  return result?.projectId === projectId ? result : undefined;
};
