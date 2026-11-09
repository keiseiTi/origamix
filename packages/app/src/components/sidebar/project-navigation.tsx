import { useState } from 'react';
import { RoutingDialog } from '@/components/project-settings/routing-dialog';
import { useLayoutConfig } from '@/components/layout/use-layout-config';
import { usePageRoles } from '@/components/page-role/use-page-roles';
import { SYSTEM_PAGE_ROLES } from '@origamix/shared';
import { Folder, File, LogIn, House, FileQuestionMark, Plus, PanelsTopLeft } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@origamix/ui';
import { useWorkspaceStore, layoutTabId, type ProjectItem } from '@/store/workspace';
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
}): React.JSX.Element => {
  const [routingOpen, setRoutingOpen] = useState(false);
  const layout = useLayoutConfig(project.id, true);
  const roles = usePageRoles(project.id);
  return (
    <section className='mb-1'>
      <div className='group flex h-8.5 items-center gap-2 rounded-lg px-2 text-zinc-700 hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-900'>
        <Folder size={14} />
        <span className='min-w-0 flex-1 truncate'>{project.name}</span>
        <SidebarActionMenu
          onRouting={() => setRoutingOpen(true)}
          label={`${project.name} 项目操作`}
          layout={{
            enabled: layout.config?.enabled ?? false,
            disabled: !layout.config || layout.busy,
            onToggle: () => void layout.toggle(!layout.config?.enabled),
          }}
          onRename={() =>
            onLifecycle({ kind: 'rename-project', id: project.id, name: project.name })
          }
          onDelete={() =>
            onLifecycle({ kind: 'delete-project', id: project.id, name: project.name })
          }
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
      {routingOpen && (
        <RoutingDialog
          key={project.id}
          projectId={project.id}
          onClose={() => setRoutingOpen(false)}
        />
      )}
      {layout.error && (
        <div role='alert' className='px-3 py-1 text-xs text-destructive'>
          {layout.error}
          <Button
            size='sm'
            variant='ghost'
            onClick={() => void layout.refresh().catch(() => undefined)}
          >
            重试读取
          </Button>
        </div>
      )}
      {roles.error && (
        <div role='alert' className='px-3 py-1 text-xs text-destructive'>
          {roles.error}
          <Button size='sm' variant='ghost' onClick={roles.refresh}>
            重试读取角色
          </Button>
        </div>
      )}
      {layout.config?.enabled && (
        <Button
          variant='ghost'
          aria-current={activePageId === layoutTabId(project.id) ? 'page' : undefined}
          className={`ml-2.5 h-8.5 w-[calc(100%-10px)] justify-start gap-2 px-4 text-xs ${activePageId === layoutTabId(project.id) ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'}`}
          onClick={() => onSelectPage(layoutTabId(project.id))}
          aria-label={`${project.name} 布局配置`}
        >
          <PanelsTopLeft size={13} />
          布局配置
        </Button>
      )}
      {project.pages.map((page) => {
        const role = SYSTEM_PAGE_ROLES.find(
          (role) => roles.state?.roles.assignments[role.id] === page.id,
        );
        const Icon =
          role?.id === 'login'
            ? LogIn
            : role?.id === 'home'
              ? House
              : role?.id === 'not-found'
                ? FileQuestionMark
                : File;
        return (
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
              <span title={role?.name ?? '普通页面'}>
                <Icon size={13} aria-label={role?.name ?? '普通页面'} />
              </span>
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
        );
      })}
    </section>
  );
};

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
