import { useEffect, useState } from 'react';
import type { PageNavigationMetadata } from '@origamix/shared';
import { projectsService } from '@/services/projects';
import { subscribeProjectPagesChanged } from '@/services/project-page-events';
export const usePageNavigationMetadata = (projectId: string, active: boolean) => {
  const [result, setResult] = useState<{
    projectId: string;
    value?: PageNavigationMetadata;
    error?: string;
  }>();
  useEffect(() => {
    if (!active) return;
    let current = true,
      sequence = 0;
    const load = () => {
      const identity = ++sequence;
      void projectsService
        .navigation(projectId)
        .then((info) => {
          if (current && sequence === identity)
            setResult({
              projectId,
              value: info.runtime === 'origamix' ? { pages: info.pages } : undefined,
            });
        })
        .catch((reason: unknown) => {
          if (current && sequence === identity)
            setResult({
              projectId,
              error: reason instanceof Error ? reason.message : '无法读取项目页面列表',
            });
        });
    };
    load();
    const unsubscribe = subscribeProjectPagesChanged(projectId, load);
    return () => {
      current = false;
      unsubscribe();
    };
  }, [projectId, active]);
  return result?.projectId === projectId ? result : undefined;
};
