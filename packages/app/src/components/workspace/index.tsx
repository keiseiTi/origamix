import type { EditorHandle } from '@/components/editor';
import { useWorkspaceStore } from '@/store/workspace';
import { EmptyWorkspace } from './mods/empty-workspace';
import { PageWorkspace } from './mods/page-workspace';
import { useMountedPages } from './hooks/use-mounted-pages';
import type { WorkspaceMode } from './workspace-header';

interface WorkspaceProps {
  editorRefForPage: (pageId: string) => { current: EditorHandle | null };
  onModeChange: (pageId: string, mode: WorkspaceMode) => Promise<void>;
  onPreview: (pageId: string) => Promise<void>;
  onConfigureModel: () => void;
  onCreateProject: () => void;
}

export const Workspace = ({
  editorRefForPage,
  onModeChange,
  onPreview,
  onConfigureModel,
  onCreateProject,
}: WorkspaceProps): React.JSX.Element => {
  const selectedPageId = useWorkspaceStore((state) => state.activeTabId);
  const mountedPageIds = useMountedPages();

  if (mountedPageIds.length === 0) return <EmptyWorkspace onCreateProject={onCreateProject} />;

  return (
    <div className='relative flex min-h-0 flex-1'>
      {mountedPageIds.map((pageId) => {
        const active = pageId === selectedPageId;
        return (
          <div
            key={pageId}
            className={`absolute inset-0 flex min-h-0 ${active ? 'visible' : 'invisible pointer-events-none'}`}
            aria-hidden={!active}
            inert={active ? undefined : true}
          >
            <PageWorkspace
              active={active}
              pageId={pageId}
              editorRef={editorRefForPage(pageId)}
              onModeChange={(mode) => onModeChange(pageId, mode)}
              onPreview={() => onPreview(pageId)}
              onConfigureModel={onConfigureModel}
            />
          </div>
        );
      })}
    </div>
  );
};

export type { WorkspaceMode } from './workspace-header';
