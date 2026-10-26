import { useEffect, useState } from 'react';
import { useEditorCore } from '../session/editor-session';
import { Button, Spinner } from '@origamix/ui';
import { useMaterialCatalog } from '../session/editor-environment';
import { FlowEditorSessionContext } from './flow-editor-context';
import type { EventTarget } from './flow-graph';

type FlowComponent = (typeof import('./flow-editor'))['FlowEditor'];
let pending: Promise<FlowComponent> | undefined;
const loadFlowEditor = (): Promise<FlowComponent> => {
  pending ??= import('./flow-editor')
    .then((module) => module.FlowEditor)
    .catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
  return pending;
};

/** The only bridge from the shared engine store to the internal flow view. */
export const FlowEditorLoader = ({
  target,
  onTargetChange,
}: {
  target: EventTarget | null;
  onTargetChange: (target: EventTarget) => void;
}): React.JSX.Element => {
  const schema = useEditorCore((state) => state.schema);
  const materials = useEditorCore((state) => state.materials);
  const setSchema = useEditorCore((state) => state.setSchema);
  const canUndo = useEditorCore((state) => state.canUndo);
  const canRedo = useEditorCore((state) => state.canRedo);
  const undo = useEditorCore((state) => state.undo);
  const redo = useEditorCore((state) => state.redo);
  const catalog = useMaterialCatalog();
  const [View, setView] = useState<FlowComponent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void loadFlowEditor().then(
      (component) => {
        if (active) setView(() => component);
      },
      (reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : '逻辑编辑器加载失败');
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);
  if (!View)
    return (
      <div
        className='grid min-h-0 flex-1 place-content-center gap-3 p-6 text-sm'
        role={error ? 'alert' : 'status'}
      >
        {error ? (
          <>
            <p className='text-destructive'>逻辑编辑器加载失败：{error}。页面草稿已保留。</p>
            <Button
              variant='outline'
              onClick={() => {
                setError(null);
                setAttempt((value) => value + 1);
              }}
            >
              重试加载逻辑编辑器
            </Button>
          </>
        ) : (
          <Spinner aria-label='加载逻辑编辑器' />
        )}
      </div>
    );
  return (
    <FlowEditorSessionContext.Provider
      value={{
        schema,
        materials,
        catalog,
        onChange: setSchema,
        history: { canUndo, canRedo, undo, redo },
      }}
    >
      <View target={target} onTargetChange={onTargetChange} />
    </FlowEditorSessionContext.Provider>
  );
};
