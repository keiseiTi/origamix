import { ProjectSettingsPanel } from '@/components/project-settings/project-settings-panel';
import type { EditorHandle } from '@origamix/editor';
import { WorkspaceRecoveryView } from './workspace-recovery-view';
import { useWorkspaceStore } from '@/store/workspace';
import { EmptyWorkspace } from './empty-workspace';
import { PageSession } from './page-session';
import { useMountedPages } from './hooks/use-mounted-pages';
import type { WorkspaceMode } from './page-toolbar';

export interface WorkspaceContentProps {
  editorRefForPage: (pageId: string) => { current: EditorHandle | null };
  onModeChange: (pageId: string, mode: WorkspaceMode) => Promise<void>;
  onPreview: (pageId: string) => Promise<void>;
  onConfigureModel: () => void;
  onCreateProject: () => void;
}

export const WorkspaceContent = ({
  editorRefForPage,
  onModeChange,
  onPreview,
  onConfigureModel,
  onCreateProject,
}: WorkspaceContentProps): React.JSX.Element => {
  const workspaceReady = useWorkspaceStore((state) => state.workspaceReady);
  const selectedPageId = useWorkspaceStore((state) => state.activeTabId);
  const tabs = useWorkspaceStore((state) => state.openPages);
  const closePage = useWorkspaceStore((state) => state.closePage);
  const mountedPageIds = useMountedPages();

  if (!workspaceReady) return <WorkspaceRecoveryView />;

  if (!selectedPageId || mountedPageIds.length === 0)
    return <EmptyWorkspace onCreateProject={onCreateProject} />;

  return (
    <div className='relative flex min-h-0 flex-1'>
      {mountedPageIds.map((pageId) => {
        const active = pageId === selectedPageId;
        const tab = tabs.find((tab) => tab.id === pageId);
        return (
          <div
            key={pageId}
            className={`absolute inset-0 flex min-h-0 ${active ? 'visible' : 'invisible pointer-events-none'}`}
            aria-hidden={!active}
            inert={active ? undefined : true}
          >
            {tab?.kind === 'project-settings' ? (
              <ProjectSettingsPanel
                projectId={tab.projectId}
                onClose={() => closePage(pageId)}
                onConfigureModel={onConfigureModel}
              />
            ) : (
              <PageSession
                active={active}
                pageId={pageId}
                editorRef={editorRefForPage(pageId)}
                onModeChange={(mode) => onModeChange(pageId, mode)}
                onPreview={() => onPreview(pageId)}
                onConfigureModel={onConfigureModel}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
