import { Button } from '@heroui/react';
import {
  Folder,
  FolderOpen,
  FolderPlus,
  MessageSquareText,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Settings,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { CreatePageModal } from './mod/create-page-modal';
import { CreateProjectModal } from './mod/create-project-modal';

export type AppTheme = 'light' | 'dark';

export interface PageItem {
  id: string;
  name: string;
  fileName: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  path: string;
  pages: PageItem[];
}

export interface UserProfile {
  name: string;
  iconBackground: string;
}

interface SidebarProps {
  projects: ProjectItem[];
  selectedPageId: string | null;
  isTemporary: boolean;
  userProfile: UserProfile;
  onCollapse: () => void;
  onPin: () => void;
  onTemporaryClose: () => void;
  onOpenSettings: () => void;
  onProjectCreated: (project: ProjectItem) => void;
  onOpenProject: () => void;
  onPageCreated: (projectId: string, page: PageItem) => void;
  onSelectPage: (pageId: string) => void;
}

export function Sidebar({
  projects,
  selectedPageId,
  isTemporary,
  userProfile,
  onCollapse,
  onPin,
  onTemporaryClose,
  onOpenSettings,
  onProjectCreated,
  onOpenProject,
  onPageCreated,
  onSelectPage,
}: SidebarProps): React.JSX.Element {
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [pageProjectId, setPageProjectId] = useState<string | null>(null);
  const pageProject = projects.find((project) => project.id === pageProjectId) ?? null;

  const keepSidebarOpen = (): void => {
    if (isTemporary) onPin();
  };

  const openProjectModal = (): void => {
    keepSidebarOpen();
    setIsProjectModalOpen(true);
  };

  const openPageModal = (projectId: string): void => {
    keepSidebarOpen();
    setPageProjectId(projectId);
  };

  const openSettingsModal = (): void => {
    keepSidebarOpen();
    onOpenSettings();
  };

  return (
    <>
      <aside
        id='project-sidebar'
        aria-label='项目侧边栏'
        className={`z-20 flex h-full w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 p-2.5 text-[13px] text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 ${
          isTemporary
            ? 'fixed inset-y-0 left-0 rounded-r-xl shadow-[8px_0_30px_rgb(0_0_0/0.14)] dark:shadow-[8px_0_30px_rgb(0_0_0/0.45)]'
            : 'relative'
        }`}
        onMouseLeave={() => isTemporary && onTemporaryClose()}
        onKeyDown={(event) => {
          if (isTemporary && event.key === 'Escape') onTemporaryClose();
        }}
      >
        <header className='flex h-10 items-center gap-2.5 px-1.5'>
          <Button
            isIconOnly
            size='sm'
            variant='ghost'
            className='h-7 min-h-7 w-7 min-w-7 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
            onPressStart={isTemporary ? undefined : onCollapse}
            onPress={isTemporary ? onPin : undefined}
            aria-label={isTemporary ? '固定展开侧边栏' : '收起侧边栏'}
          >
            {isTemporary ? <PanelLeft size={17} /> : <PanelLeftClose size={17} />}
          </Button>
          <strong className='font-semibold'>Origamix</strong>
        </header>

        <Button
          variant='ghost'
          className='mt-2 h-9 w-full justify-start gap-2 px-2.5 hover:bg-white dark:hover:bg-zinc-900'
          onPress={openProjectModal}
        >
          <FolderPlus size={15} />
          新建项目
        </Button>
        <Button
          variant='ghost'
          className='mt-1 h-9 w-full justify-start gap-2 px-2.5 hover:bg-white dark:hover:bg-zinc-900'
          onPress={onOpenProject}
        >
          <FolderOpen size={15} />
          打开项目
        </Button>
        <div className='mx-2 mt-4 mb-1.5 text-[11px] font-semibold tracking-[0.04em] text-zinc-500 uppercase dark:text-zinc-400'>
          项目
        </div>
        <nav className='min-h-0 flex-1 overflow-auto'>
          {projects.map((project) => (
            <section className='mb-1' key={project.id}>
              <div className='group flex h-8.5 items-center gap-2 rounded-lg px-2 text-zinc-700 hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-900'>
                <Folder size={14} />
                <span className='min-w-0 flex-1 truncate'>{project.name}</span>
                <Button
                  isIconOnly
                  size='sm'
                  variant='ghost'
                  className='h-6 min-h-6 w-6 min-w-6 opacity-0 group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  onPress={() => openPageModal(project.id)}
                  aria-label={`在 ${project.name} 中新建页面`}
                >
                  <Plus size={14} />
                </Button>
              </div>
              {project.pages.map((page) => (
                <Button
                  key={page.id}
                  variant='ghost'
                  onPress={() => onSelectPage(page.id)}
                  className={`ml-2.5 h-8.5 w-[calc(100%-0.625rem)] justify-start gap-2 px-4 text-left ${
                    selectedPageId === page.id
                      ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                      : 'text-zinc-500 hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  <MessageSquareText size={13} />
                  <span className='truncate'>{page.name}</span>
                </Button>
              ))}
            </section>
          ))}
        </nav>
        <Button
          variant='ghost'
          className='mt-auto h-10 w-full justify-start gap-2.5 px-2 text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
          onPress={openSettingsModal}
        >
          <span
            className='grid h-7 w-7 shrink-0 place-items-center rounded-full text-white shadow-sm'
            style={{ backgroundColor: userProfile.iconBackground }}
          >
            <User size={17} />
          </span>
          <span className='min-w-0 flex-1 truncate text-left'>{userProfile.name}</span>
          <Settings size={14} className='text-zinc-400' />
        </Button>
      </aside>

      <CreateProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onCreated={onProjectCreated}
      />
      <CreatePageModal
        project={pageProject}
        onClose={() => setPageProjectId(null)}
        onCreated={onPageCreated}
      />
    </>
  );
}
