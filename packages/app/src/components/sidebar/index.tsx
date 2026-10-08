import { Button } from '@/components/ui/button';
import {
  Folder,
  FolderOpen,
  FolderPlus,
  MessageSquareText,
  Plus,
  Settings,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { CreatePageModal } from './mod/create-page-modal';
import { CreateProjectModal } from './mod/create-project-modal';
import { OpenProjectModal } from './mod/open-project-modal';
import { LifecycleModal, type LifecycleTarget } from './mod/lifecycle-modal';
import { SidebarActionMenu } from './action-menu';
import { usePreferencesStore } from '@/store/preferences';
import { useWorkspaceStore, type PageItem } from '@/store/workspace';
import { useProjectActions } from '@/hooks/use-project-actions';

interface SidebarProps {
  isMacDesktop: boolean;
  onPin: () => void;
  onTemporaryClose: () => void;
  onOpenSettings: () => void;
  flushEditor: () => Promise<void>;
  onPageCreated: (projectId: string, page: PageItem) => void;
  onSelectPage: (pageId: string) => void;
}

export const Sidebar = ({
  isMacDesktop,
  onPin,
  onTemporaryClose,
  onOpenSettings,
  flushEditor,
  onPageCreated,
  onSelectPage,
}: SidebarProps): React.JSX.Element => {
  const { projects, selectedPageId, isTemporary } = useWorkspaceStore(
    useShallow((state) => ({
      projects: state.projects,
      selectedPageId: state.activeTabId,
      isTemporary: state.sidebarCollapsed ?? false,
    })),
  );
  const supportsNativeProjectDirectories = Boolean(window.api?.dialog);
  const userProfile = usePreferencesStore((state) => state.userProfile);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [pageProjectId, setPageProjectId] = useState<string | null>(null);
  const [lifecycleTarget, setLifecycleTarget] = useState<LifecycleTarget | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const projectActions = useProjectActions({
    flushEditor,
    onPageAdded: onPageCreated,
    onError: setActionError,
  });

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
        className={`z-20 flex h-full w-60 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 px-2.5 pb-2.5 text-[13px] text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 ${
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
          onClick={openProjectModal}
          disabled={!supportsNativeProjectDirectories}
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
          onClick={() => {
            keepSidebarOpen();
            setActionError(null);
            void projectActions
              .openProject()
              .catch((reason: unknown) =>
                setActionError(reason instanceof Error ? reason.message : '项目打开失败'),
              );
          }}
          disabled={!supportsNativeProjectDirectories}
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
                <SidebarActionMenu
                  label={`${project.name} 项目操作`}
                  onRename={() =>
                    setLifecycleTarget({
                      kind: 'rename-project',
                      id: project.id,
                      name: project.name,
                    })
                  }
                  onDelete={() =>
                    setLifecycleTarget({
                      kind: 'delete-project',
                      id: project.id,
                      name: project.name,
                    })
                  }
                />
                <Button
                  size='icon-xs'
                  variant='ghost'
                  className='h-6 min-h-6 w-6 min-w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  onClick={() => openPageModal(project.id)}
                  aria-label={`在 ${project.name} 中新建页面`}
                >
                  <Plus size={14} />
                </Button>
              </div>
              {project.pages.map((page) => (
                <div
                  key={page.id}
                  className={`group ml-2.5 flex h-8.5 items-center rounded-lg pr-1 transition-colors ${
                    selectedPageId === page.id
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
                      setLifecycleTarget({
                        kind: 'rename-page',
                        projectId: project.id,
                        id: page.id,
                        name: page.name,
                      })
                    }
                    onDelete={() =>
                      setLifecycleTarget({
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
          ))}
        </nav>
        <Button
          variant='ghost'
          className='mt-auto h-10 w-full justify-start gap-2.5 px-2 text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
          onClick={openSettingsModal}
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
      {projectActions.pendingInitialization && (
        <OpenProjectModal
          key={projectActions.pendingInitialization.directoryGrantId}
          pendingInitialization={projectActions.pendingInitialization}
          initializing={projectActions.initializing}
          onCancel={() => projectActions.setPendingInitialization(null)}
          onInitialize={projectActions.initializePendingProject}
        />
      )}

      <CreateProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
      />
      <CreatePageModal
        projectId={pageProjectId}
        onClose={() => setPageProjectId(null)}
        onCreated={onPageCreated}
      />
      <LifecycleModal
        key={lifecycleTarget ? `${lifecycleTarget.kind}:${lifecycleTarget.id}` : 'closed'}
        target={lifecycleTarget}
        onClose={() => setLifecycleTarget(null)}
        onConfirm={async (target, name) => {
          if (target.kind === 'rename-project')
            await projectActions.renameProject(target.id, name!);
          else if (target.kind === 'delete-project') await projectActions.deleteProject(target.id);
          else if (target.kind === 'rename-page')
            await projectActions.renamePage(target.projectId, target.id, name!);
          else await projectActions.deletePage(target.projectId, target.id);
        }}
      />
      {actionError && (
        <div
          role='alert'
          className='fixed bottom-4 left-4 z-50 rounded-lg bg-danger p-3 text-sm text-danger-foreground'
        >
          {actionError}
          <Button size='sm' variant='ghost' onClick={() => setActionError(null)}>
            关闭
          </Button>
        </div>
      )}
    </>
  );
};
