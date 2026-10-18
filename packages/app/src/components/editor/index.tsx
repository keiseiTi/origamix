import { Editor as EditorView } from '@origamix/editor';
import type {
  EditorHandle,
  EditorMode,
  EditorTool,
  EditorHistoryState,
  EditorTargetSelection,
} from '@origamix/editor';
import { Spinner, Button } from '@origamix/ui';

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { usePreferencesStore } from '@/store/preferences';
import { useEditorMaterials } from '@/materials/use-editor-materials';
import { useEditorSession } from './use-editor-session';

interface EditorProps {
  visible: boolean;
  projectId: string;
  pageId: string;
  readOnly?: boolean;
  readOnlyMessage?: string;
  viewportWidth: number;
  mode?: EditorMode;
  onModeChange?: (mode: EditorMode) => Promise<void>;
  tool: Exclude<EditorTool, 'history'> | null;
  onCloseTool: () => void;
  onHistoryStateChange: (state: EditorHistoryState) => void;
  onWorkingCommitted?: () => void;
  targetSelection?: EditorTargetSelection;
}

export const PageEditor = forwardRef<EditorHandle, EditorProps>(
  ({ projectId, pageId, visible, onWorkingCommitted, readOnly = false, ...viewProps }, ref) => {
    const theme = usePreferencesStore((state) => state.theme);
    const materials = useEditorMaterials(projectId, visible);
    const session = useEditorSession(
      projectId,
      pageId,
      readOnly,
      onWorkingCommitted,
      Boolean(materials.registration),
    );
    const viewRef = useRef<EditorHandle>(null);
    useImperativeHandle(
      ref,
      () => ({
        flush: session.flush,
        undo: () => viewRef.current?.undo(),
        redo: () => viewRef.current?.redo(),
      }),
      [session.flush],
    );
    // Keep host recovery alive without mounting canvas portals in chat or preview.
    if (!visible) return null;
    if (materials.error)
      return (
        <div
          role='alert'
          className='grid min-h-0 flex-1 place-content-center gap-3 p-6 text-sm text-destructive'
        >
          <span>{materials.error}。页面草稿已保留，请检查项目配置后重试。</span>
          <Button variant='outline' onClick={materials.retry}>
            重试加载物料
          </Button>
        </div>
      );
    if (session.loading || !materials.registration)
      return (
        <div className='grid min-h-0 flex-1 place-items-center'>
          <Spinner aria-label='加载编辑器' />
        </div>
      );
    if (!session.initial)
      return (
        <div
          role='alert'
          className='grid min-h-0 flex-1 place-items-center p-6 text-sm text-destructive'
        >
          {session.error ?? 'Schema 不可用'}
        </div>
      );
    return (
      <>
        {session.error && (
          <div
            role='alert'
            className='flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-xs text-destructive'
          >
            <span>{session.error}；编辑内容已保留。</span>
            <Button
              size='sm'
              variant='outline'
              onClick={() => void session.flush().catch(() => undefined)}
            >
              重试保存草稿
            </Button>
          </div>
        )}
        <EditorView
          {...viewProps}
          ref={viewRef}
          schema={session.initial.schema}
          sessionKey={session.providerKey}
          registration={materials.registration}
          theme={theme}
          readOnly={readOnly}
          onChange={session.onChange}
          onFlush={session.flush}
        />
      </>
    );
  },
);
