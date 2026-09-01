import { useState, type RefObject } from 'react';
import type { PageItem } from '../sidebar';
import { ChatWorkspace } from './chat-workspace';
import type { EditorHandle } from './editor-workspace';
import { EditorSession } from './editor-session';
import { WorkspaceDrawer } from './workspace-drawer';
import { EmptyWorkspace } from './empty-workspace';
import { WorkspaceHeader, type WorkspaceMode } from './workspace-header';

interface WorkspaceProps {
  page?: PageItem;
  projectId?: string;
  projectName?: string;
  mode: WorkspaceMode;
  sidebarCollapsed: boolean;
  onCreateProject: () => void;
  editorRef: RefObject<EditorHandle | null>;
  onModeChange: (mode: WorkspaceMode) => Promise<void>;
  onBeforePreview: () => Promise<void>;
}

export function Workspace({
  page,
  projectId,
  projectName,
  mode,
  sidebarCollapsed,
  onCreateProject,
  editorRef,
  onModeChange,
  onBeforePreview,
}: WorkspaceProps): React.JSX.Element {
  const [aiOpen, setAiOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState('加载中…');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const chat = page && (
    <ChatWorkspace
      pageName={page.name}
      draft={drafts[page.id] ?? ''}
      onDraftChange={(draft) => setDrafts((current) => ({ ...current, [page.id]: draft }))}
    />
  );
  return (
    <section className='relative flex min-w-0 flex-1 flex-col bg-white dark:bg-zinc-950'>
      {page && projectId && (
        <WorkspaceHeader
          projectName={projectName ?? '未命名项目'}
          pageName={page.name}
          projectId={projectId}
          pageId={page.id}
          sidebarCollapsed={sidebarCollapsed}
          mode={mode}
          onModeChange={onModeChange}
          onBeforePreview={onBeforePreview}
          onOpenAI={() => setAiOpen(true)}
          saveStatus={saveStatus}
          onUndo={async () => {
            await editorRef.current?.undo();
          }}
        />
      )}
      {!page ? (
        <EmptyWorkspace onCreateProject={onCreateProject} />
      ) : (
        <>
          <div className={mode === 'chat' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>{chat}</div>
          {projectId && (
            <EditorSession
              editorRef={editorRef}
              visible={mode === 'edit'}
              projectId={projectId}
              page={page}
              onStatusChange={setSaveStatus}
            />
          )}
          <WorkspaceDrawer
            open={aiOpen && mode === 'edit'}
            onClose={() => setAiOpen(false)}
            title={`AI · ${page.name}`}
            side='right'
          >
            {chat}
          </WorkspaceDrawer>
        </>
      )}
    </section>
  );
}

export type { WorkspaceMode } from './workspace-header';
