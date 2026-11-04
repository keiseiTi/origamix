import { useState } from 'react';
import { useEditorSelector, useEditorContext } from '@origamix/editor';
import { Button } from '@origamix/ui';
import { PageToolbarShell } from './page-toolbar';
import { CanvasControls } from './toolbar/canvas-controls';
import { EditorToolDialog, type EditorTool } from './editor-tool-dialog';
import type { WorkspaceToolbarProps } from './agent-chat-toolbar';
export const EditorToolbar = (props: WorkspaceToolbarProps) => {
  const [tool, setTool] = useState<EditorTool | null>(null);
  const mode = useEditorSelector((state) => state.mode);
  const canUndo = useEditorSelector((state) => state.canUndo && !state.readOnly);
  const canRedo = useEditorSelector((state) => state.canRedo && !state.readOnly);
  const viewportWidth = useEditorSelector((state) => state.viewportWidth);
  const commands = useEditorContext();
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  return (
    <>
      <PageToolbarShell {...props} navigation='chat' onOpenEditorTool={setTool}>
        <div className='flex min-w-0 items-center gap-3'>
          <div
            role='group'
            aria-label='编辑模式'
            className='flex shrink-0 items-center gap-1 rounded-lg border border-border p-0.5'
          >
            {(['view', 'logic'] as const).map((value) => (
              <Button
                key={value}
                size='sm'
                variant={mode === value ? 'secondary' : 'ghost'}
                aria-pressed={mode === value}
                disabled={switching}
                onClick={() => {
                  setSwitching(true);
                  setError(null);
                  void commands
                    .setMode(value)
                    .catch((reason: unknown) =>
                      setError(
                        reason instanceof Error ? reason.message : '切换失败，编辑内容已保留',
                      ),
                    )
                    .finally(() => setSwitching(false));
                }}
              >
                {value === 'view' ? '视图' : '逻辑'}
              </Button>
            ))}
          </div>
          {mode === 'view' && (
            <CanvasControls
              viewportWidth={viewportWidth}
              onViewportWidthChange={commands.setViewportWidth}
              historyState={{ canUndo, canRedo }}
              onUndo={commands.undo}
              onRedo={commands.redo}
            />
          )}
          {error && (
            <span role='alert' className='max-w-56 truncate text-xs text-danger' title={error}>
              {error}
            </span>
          )}
        </div>
      </PageToolbarShell>
      <EditorToolDialog tool={tool} onClose={() => setTool(null)} />
    </>
  );
};
