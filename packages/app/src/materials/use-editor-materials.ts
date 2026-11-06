import { useEffect, useMemo, useState } from 'react';
import type { EditorMaterialRegistration } from '@origamix/editor';
import { projectsService } from '@/services/projects';
import { loadEditorMaterials, loadRuntimeMaterials } from './loaders';

export const useEditorMaterials = (
  projectId: string,
  enabled: boolean,
  kind: 'page' | 'layout' = 'page',
) => {
  const [attempt, setAttempt] = useState(0);
  const scope = useMemo(() => ({ projectId, attempt, kind }), [projectId, attempt, kind]);
  const [result, setResult] = useState<{
    scope: typeof scope;
    registration?: EditorMaterialRegistration;
    Provider?: Awaited<ReturnType<typeof loadRuntimeMaterials>>['Provider'];
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    projectsService
      .stack(scope.projectId)
      .then((stack) =>
        Promise.all([
          scope.kind === 'layout'
            ? loadEditorMaterials(stack.materialSet, scope.kind)
            : loadEditorMaterials(stack.materialSet),
          loadRuntimeMaterials(stack.materialSet),
        ]),
      )
      .then(([registration, runtime]) => {
        if (active) setResult({ scope, registration, Provider: runtime.Provider });
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
    Provider: result?.scope === scope ? result.Provider : undefined,
    error: result?.scope === scope ? result.error : undefined,
    retry: () => setAttempt((value) => value + 1),
  };
};
