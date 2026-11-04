import { useState } from 'react';
import { ModeTools, ViewportTools, HistoryTools } from '@origamix/editor';
import { PageToolbarShell } from './page-toolbar';
import { EditorToolDialog, type EditorTool } from './editor-tool-dialog';
import type { WorkspaceToolbarProps } from './agent-chat-toolbar';

export const WorkspaceToolbar = (props: WorkspaceToolbarProps) => {
  const [tool, setTool] = useState<EditorTool | null>(null);
  return (
    <>
      <PageToolbarShell {...props} navigation='chat' onOpenEditorTool={setTool}>
        <div className='flex min-w-0 flex-1 items-center justify-center gap-2'>
          <ModeTools />
          <ViewportTools />
          <HistoryTools />
        </div>
      </PageToolbarShell>
      <EditorToolDialog tool={tool} onClose={() => setTool(null)} />
    </>
  );
};
