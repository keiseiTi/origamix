import { useEffect, useMemo, useState } from 'react';
import type { EditorMaterialRegistration } from '@origamix/editor/contracts';
import { projectsService } from '@/services/projects';
import { loadEditorMaterials } from './loaders';

export const useEditorMaterials = (projectId: string, enabled: boolean) => {
  const [attempt, setAttempt] = useState(0);
  const scope = useMemo(() => ({ projectId, attempt }), [projectId, attempt]);
  const [result, setResult] = useState<{
    scope: typeof scope;
    registration?: EditorMaterialRegistration;
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    projectsService
      .stack(scope.projectId)
      .then(loadEditorMaterials)
      .then((registration) => {
        if (active) setResult({ scope, registration });
      })
      .catch((reason: unknown) => {
        if (active)
          setResult({
            scope,
            error: reason instanceof Error ? reason.message : '无法加载项目物料',
          });
      });
    return () => {
      active = false;
    };
  }, [scope, enabled]);
  return {
    registration: result?.scope === scope ? result.registration : undefined,
    error: result?.scope === scope ? result.error : undefined,
    retry: () => setAttempt((value) => value + 1),
  };
};
