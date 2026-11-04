import { Editor as EditorView } from '@origamix/editor';
import type { EditorHandle, EditorInstance, EditorTargetSelection } from '@origamix/editor';
import { Spinner, Button, useToastManager } from '@origamix/ui';

import { useImperativeHandle, useState, type Ref, type ReactNode } from 'react';
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
  editor: EditorInstance;
  toolbar?: ReactNode;
  onWorkingCommitted?: () => void;
  onReturnToChat: () => Promise<void>;
  targetSelection?: EditorTargetSelection;
}

export const PageEditor = ({
  ref,
  projectId,
  pageId,
  visible,
  onWorkingCommitted,
  onReturnToChat,
  readOnly = false,
  ...viewProps
}: EditorProps) => {
  const notifications = useToastManager();
  const [returningToChat, setReturningToChat] = useState(false);
  const returnToChat = async (): Promise<void> => {
    setReturningToChat(true);
    try {
      await onReturnToChat();
    } catch (reason) {
      notifications.add({
        type: 'error',
        title: reason instanceof Error ? reason.message : '返回对话失败，编辑内容已保留',
      });
    } finally {
      setReturningToChat(false);
    }
  };
  const returnToChatButton = (
    <Button variant='outline' disabled={returningToChat} onClick={() => void returnToChat()}>
      {returningToChat ? '正在返回…' : '返回对话'}
    </Button>
  );
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
      <div
        role='alert'
        className='grid min-h-0 flex-1 place-content-center gap-3 p-6 text-sm text-destructive'
      >
        <span>{materials.error}。页面草稿已保留，请检查项目配置后重试。</span>
        <div className='flex flex-wrap justify-center gap-2'>
          <Button variant='outline' onClick={materials.retry}>
            重试加载物料
          </Button>
          {returnToChatButton}
        </div>
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
        className='grid min-h-0 flex-1 place-content-center justify-items-center gap-3 p-6 text-sm text-destructive'
      >
        <span>{session.error ?? 'Schema 不可用'}</span>
        {returnToChatButton}
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
