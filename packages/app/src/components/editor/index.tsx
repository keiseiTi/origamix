import { Editor as EditorView } from '@origamix/editor';
import type { EditorHandle, EditorMode, EditorTool, EditorTargetSelection } from '@origamix/editor';
import { Spinner, Button } from '@origamix/ui';

import { useImperativeHandle, type Ref, type ReactNode } from 'react';
import { usePreferencesStore } from '@/store/preferences';
import { useEditorMaterials } from '@/materials/use-editor-materials';
import { useEditorSession } from './use-editor-session';

interface EditorProps {
  ref?: Ref<EditorHandle>;
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
  toolbar?: ReactNode;
  loadingToolbar?: ReactNode;
  onViewportWidthChange: (width: number) => void;
  onToolChange: (tool: Exclude<EditorTool, 'history'> | null) => void;
  onWorkingCommitted?: () => void;
  targetSelection?: EditorTargetSelection;
}

export const PageEditor = ({
  ref,
  projectId,
  pageId,
  visible,
  loadingToolbar,
  onWorkingCommitted,
  readOnly = false,
  ...viewProps
}: EditorProps) => {
  const theme = usePreferencesStore((state) => state.theme);
  const materials = useEditorMaterials(projectId, visible);
  const session = useEditorSession(
    projectId,
    pageId,
    readOnly,
    onWorkingCommitted,
    Boolean(materials.registration),
  );
  useImperativeHandle(
    ref,
    () => ({
      flush: session.flush,
    }),
    [session.flush],
  );
  // Keep host recovery alive without mounting canvas portals in chat or preview.
  if (!visible) return null;
  if (materials.error)
    return (
      <>
        {loadingToolbar}
        <div
          role='alert'
          className='grid min-h-0 flex-1 place-content-center gap-3 p-6 text-sm text-destructive'
        >
          <span>{materials.error}。页面草稿已保留，请检查项目配置后重试。</span>
          <Button variant='outline' onClick={materials.retry}>
            重试加载物料
          </Button>
        </div>
      </>
    );
  if (session.loading || !materials.registration)
    return (
      <>
        {loadingToolbar}
        <div className='grid min-h-0 flex-1 place-items-center'>
          <Spinner aria-label='加载编辑器' />
        </div>
      </>
    );
  if (!session.initial)
    return (
      <>
        {loadingToolbar}
        <div
          role='alert'
          className='grid min-h-0 flex-1 place-items-center p-6 text-sm text-destructive'
        >
          {session.error ?? 'Schema 不可用'}
        </div>
      </>
    );
  return (
    <>
      {session.initial.migration && (
        <p
          role='status'
          className='border-b border-border bg-muted px-3 py-2 text-xs text-muted-foreground'
        >
          页面已从 {session.initial.migration.from} 升级到 {session.initial.migration.to}
          。请验证内容，再保存版本并应用到项目。
        </p>
      )}
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
        schema={session.initial.schema}
        sessionKey={session.providerKey}
        registration={materials.registration}
        theme={theme}
        readOnly={readOnly}
        onChange={session.onChange}
      />
    </>
  );
};
