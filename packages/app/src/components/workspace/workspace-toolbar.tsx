import { createContext, useContext, useState, type ReactNode } from 'react';
import { EditorToolbarArea, useEditorContext, useEditorSelector } from '@origamix/editor';
import { PageToolbarShell } from './page-toolbar';
import { EditorToolDialog, type EditorTool } from './editor-tool-dialog';
import type { WorkspaceToolbarProps } from './agent-chat-toolbar';

// Host values update independently of the fixed plugin definitions captured by useCreateEditor.
const WorkspaceToolbarContext = createContext<WorkspaceToolbarProps | null>(null);
export const WorkspaceToolbarProvider = ({
  value,
  children,
}: {
  value: WorkspaceToolbarProps;
  children: ReactNode;
}) => <WorkspaceToolbarContext.Provider value={value}>{children}</WorkspaceToolbarContext.Provider>;

export const WorkspaceToolbar = () => {
  const props = useContext(WorkspaceToolbarContext);
  const editor = useEditorContext();
  const saving = useEditorSelector((state) => state.saving);
  const [tool, setTool] = useState<EditorTool | null>(null);
  if (!props) throw new Error('Workspace toolbar host is unavailable');
  return (
    <>
      <PageToolbarShell
        {...props}
        navigation='chat'
        onOpenEditorTool={setTool}
        onSaveVersion={editor.save}
        saveBusy={saving}
      >
        <EditorToolbarArea area='center' />
      </PageToolbarShell>
      <EditorToolDialog tool={tool} onClose={() => setTool(null)} />
    </>
  );
};
