import { Button } from '@heroui/react';
import {
  Folder,
  FolderOpen,
  FolderPlus,
  Copy,
  Pencil,
  Trash2,
  MessageSquareText,
  Plus,
  Settings,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { CreatePageModal } from './mod/create-page-modal';
import { CreateProjectModal } from './mod/create-project-modal';
import { LifecycleModal, type LifecycleTarget } from './mod/lifecycle-modal';

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
  isMacDesktop: boolean;
  userProfile: UserProfile;
  onPin: () => void;
  onTemporaryClose: () => void;
  onOpenSettings: () => void;
  onProjectCreated: (project: ProjectItem) => void;
  onOpenProject: () => void;
  onPageCreated: (projectId: string, page: PageItem) => void;
  onSelectPage: (pageId: string) => void;
  onRenameProject: (projectId: string, name: string) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onRenamePage: (projectId: string, pageId: string, name: string) => Promise<void>;
  onDeletePage: (projectId: string, pageId: string) => Promise<void>;
  onDuplicatePage: (projectId: string, pageId: string) => Promise<void>;
  supportsNativeProjectDirectories: boolean;
}

export function Sidebar({
  projects,
  selectedPageId,
  isTemporary,
  isMacDesktop,
  userProfile,
  onPin,
  onTemporaryClose,
  onOpenSettings,
  onProjectCreated,
  onOpenProject,
  onPageCreated,
  onSelectPage,
  onRenameProject,
  onDeleteProject,
  onRenamePage,
  onDeletePage,
  onDuplicatePage,
  supportsNativeProjectDirectories,
}: SidebarProps): React.JSX.Element {
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [pageProjectId, setPageProjectId] = useState<string | null>(null);
  const [lifecycleTarget, setLifecycleTarget] = useState<LifecycleTarget | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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
        className={`z-20 flex h-full w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 px-2.5 pb-2.5 text-[13px] text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 ${
          isTemporary
            ? 'fixed inset-y-0 left-0 rounded-r-xl shadow-[8px_0_30px_rgb(0_0_0/0.14)] dark:shadow-[8px_0_30px_rgb(0_0_0/0.45)]'
            : 'relative'
        }`}
        onMouseLeave={() => isTemporary && onTemporaryClose()}
        onKeyDown={(event) => {
          if (isTemporary && event.key === 'Escape') onTemporaryClose();
        }}
      >
        <header
          className={`window-drag-region flex h-10 shrink-0 items-center gap-2 pr-1 ${
            isMacDesktop ? 'pl-19' : 'pl-1'
          }`}
        >
          <span aria-hidden='true' className='h-7 w-7 shrink-0' />
          <strong className='truncate text-[15px] leading-none font-semibold'>Origamix</strong>
        </header>

        <Button
          variant='ghost'
          className='mt-2 h-9 w-full justify-start gap-2 px-2.5 hover:bg-white dark:hover:bg-zinc-900'
          onPress={openProjectModal}
          isDisabled={!supportsNativeProjectDirectories}
          aria-label={
            supportsNativeProjectDirectories ? '新建项目' : '新建项目；浏览器端下载与导入尚未接入'
          }
        >
          <FolderPlus size={15} />
          新建项目
        </Button>
        <Button
          variant='ghost'
          className='mt-1 h-9 w-full justify-start gap-2 px-2.5 hover:bg-white dark:hover:bg-zinc-900'
          onPress={onOpenProject}
          isDisabled={!supportsNativeProjectDirectories}
          aria-label={
            supportsNativeProjectDirectories ? '打开项目' : '打开项目；浏览器不能直接访问本机目录'
          }
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
                  className='h-6 min-h-6 w-6 min-w-6 opacity-0 group-hover:opacity-100'
                  aria-label={`修改项目 ${project.name} 名称`}
                  onPress={() =>
                    setLifecycleTarget({
                      kind: 'rename-project',
                      id: project.id,
                      name: project.name,
                    })
                  }
                >
                  <Pencil size={13} />
                </Button>
                <Button
                  isIconOnly
                  size='sm'
                  variant='ghost'
                  className='h-6 min-h-6 w-6 min-w-6 opacity-0 group-hover:opacity-100 text-danger'
                  aria-label={`删除项目 ${project.name}`}
                  onPress={() =>
                    setLifecycleTarget({
                      kind: 'delete-project',
                      id: project.id,
                      name: project.name,
                    })
                  }
                >
                  <Trash2 size={13} />
                </Button>
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
                <div key={page.id} className='group flex items-center'>
                  <Button
                    variant='ghost'
                    onPress={() => onSelectPage(page.id)}
                    className={`ml-2.5 h-8.5 min-w-0 flex-1 justify-start gap-2 px-4 text-left ${
                      selectedPageId === page.id
                        ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                        : 'text-zinc-500 hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    <MessageSquareText size={13} />
                    <span className='truncate'>{page.name}</span>
                  </Button>
                  <Button
                    isIconOnly
                    size='sm'
                    variant='ghost'
                    className='h-6 min-h-6 w-6 min-w-6 opacity-0 group-hover:opacity-100'
                    aria-label={`复制页面 ${page.name}`}
                    onPress={() =>
                      void onDuplicatePage(project.id, page.id).catch((reason: unknown) =>
                        setActionError(reason instanceof Error ? reason.message : '复制页面失败'),
                      )
                    }
                  >
                    <Copy size={12} />
                  </Button>
                  <Button
                    isIconOnly
                    size='sm'
                    variant='ghost'
                    className='h-6 min-h-6 w-6 min-w-6 opacity-0 group-hover:opacity-100'
                    aria-label={`修改页面 ${page.name} 名称`}
                    onPress={() =>
                      setLifecycleTarget({
                        kind: 'rename-page',
                        projectId: project.id,
                        id: page.id,
                        name: page.name,
                      })
                    }
                  >
                    <Pencil size={12} />
                  </Button>
                  <Button
                    isIconOnly
                    size='sm'
                    variant='ghost'
                    className='h-6 min-h-6 w-6 min-w-6 opacity-0 group-hover:opacity-100 text-danger'
                    aria-label={`删除页面 ${page.name}`}
                    onPress={() =>
                      setLifecycleTarget({
                        kind: 'delete-page',
                        projectId: project.id,
                        id: page.id,
                        name: page.name,
                      })
                    }
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
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
      <LifecycleModal
        key={lifecycleTarget ? `${lifecycleTarget.kind}:${lifecycleTarget.id}` : 'closed'}
        target={lifecycleTarget}
        onClose={() => setLifecycleTarget(null)}
        onConfirm={async (target, name) => {
          if (target.kind === 'rename-project') await onRenameProject(target.id, name!);
          else if (target.kind === 'delete-project') await onDeleteProject(target.id);
          else if (target.kind === 'rename-page')
            await onRenamePage(target.projectId, target.id, name!);
          else await onDeletePage(target.projectId, target.id);
        }}
      />
      {actionError && (
        <div
          role='alert'
          className='fixed bottom-4 left-4 z-50 rounded-lg bg-danger p-3 text-sm text-danger-foreground'
        >
          {actionError}
          <Button size='sm' variant='ghost' onPress={() => setActionError(null)}>
            关闭
          </Button>
        </div>
      )}
    </>
  );
}
