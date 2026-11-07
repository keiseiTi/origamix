import { useEffect, useState } from 'react';
import type { PageRoleState } from '@origamix/shared';
import { projectsService } from '@/services/projects';
import { subscribePageRolesChanged } from '@/services/page-role-events';
import { subscribeBackendReady } from '@/services/request';

export const usePageRoles = (projectId: string) => {
  const [value, setValue] = useState<{ projectId: string; state: PageRoleState } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    let generation = 0;
    const load = () => {
      const request = ++generation;
      void projectsService
        .pageRoles(projectId)
        .then((state) => {
          if (current && request === generation) {
            setValue({ projectId, state });
            setError(null);
          }
        })
        .catch((reason: unknown) => {
          if (current && request === generation)
            setError(reason instanceof Error ? reason.message : '无法读取页面角色');
        });
    };
    load();
    const unsubscribeRoles = subscribePageRolesChanged((id) => {
      if (id === projectId) load();
    });
    const unsubscribeBackend = subscribeBackendReady(load);
    return () => {
      current = false;
      unsubscribeRoles();
      unsubscribeBackend();
    };
  }, [projectId, attempt]);
  return {
    state: value?.projectId === projectId ? value.state : null,
    error,
    refresh: () => setAttempt((value) => value + 1),
  };
};
