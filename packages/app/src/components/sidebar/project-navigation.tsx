import { Folder, MessageSquareText, Plus } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/components/ui/button';
import { useWorkspaceStore, type ProjectItem } from '@/store/workspace';
import { SidebarActionMenu } from './action-menu';
import type { LifecycleTarget } from './mod/lifecycle-modal';

interface ProjectNavigationProps {
  onCreatePage: (projectId: string) => void;
  onSelectPage: (pageId: string) => void;
  onLifecycle: (target: LifecycleTarget) => void;
}

const ProjectNavigationRow = ({
  project,
  activePageId,
  onCreatePage,
  onSelectPage,
  onLifecycle,
}: ProjectNavigationProps & {
  project: ProjectItem;
  activePageId: string | null;
}): React.JSX.Element => (
  <section className='mb-1'>
    <div className='group flex h-8.5 items-center gap-2 rounded-lg px-2 text-zinc-700 hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-900'>
      <Folder size={14} />
      <span className='min-w-0 flex-1 truncate'>{project.name}</span>
      <SidebarActionMenu
        label={`${project.name} 项目操作`}
        onRename={() => onLifecycle({ kind: 'rename-project', id: project.id, name: project.name })}
        onDelete={() => onLifecycle({ kind: 'delete-project', id: project.id, name: project.name })}
      />
      <Button
        size='icon-xs'
        variant='ghost'
        className='h-6 min-h-6 w-6 min-w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-800'
        onClick={() => onCreatePage(project.id)}
        aria-label={`在 ${project.name} 中新建页面`}
      >
        <Plus size={14} />
      </Button>
    </div>
    {project.pages.map((page) => (
      <div
        key={page.id}
        className={`group ml-2.5 flex h-8.5 items-center rounded-lg pr-1 transition-colors ${
          activePageId === page.id
            ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
            : 'text-zinc-500 hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
        }`}
      >
        <Button
          variant='ghost'
          onClick={() => onSelectPage(page.id)}
          className='h-full min-w-0 flex-1 justify-start gap-2 bg-transparent px-4 text-left text-inherit hover:bg-transparent'
        >
          <MessageSquareText size={13} />
          <span className='truncate'>{page.name}</span>
        </Button>
        <SidebarActionMenu
          label={`${page.name} 页面操作`}
          onRename={() =>
            onLifecycle({
              kind: 'rename-page',
              projectId: project.id,
              id: page.id,
              name: page.name,
            })
          }
          onDelete={() =>
            onLifecycle({
              kind: 'delete-page',
              projectId: project.id,
              id: page.id,
              name: page.name,
            })
          }
        />
      </div>
    ))}
  </section>
);

export const ProjectNavigation = ({
  onCreatePage,
  onSelectPage,
  onLifecycle,
}: ProjectNavigationProps): React.JSX.Element => {
  const { projects, activePageId } = useWorkspaceStore(
    useShallow((state) => ({ projects: state.projects, activePageId: state.activeTabId })),
  );

  return (
    <nav className='min-h-0 flex-1 overflow-auto'>
      {projects.map((project) => (
        <ProjectNavigationRow
          key={project.id}
          project={project}
          activePageId={activePageId}
          onCreatePage={onCreatePage}
          onSelectPage={onSelectPage}
          onLifecycle={onLifecycle}
        />
      ))}
    </nav>
  );
};
