import { TooltipProvider } from '@/components/ui/tooltip';
import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Sidebar } from '@/components/sidebar';
import { CreateProjectModal } from '@/components/sidebar/mod/create-project-modal';
import { SettingsModal } from '@/components/settings';
import { Workspace } from '@/components/workspace';
import { PageTabs } from '@/components/workspace/page-tabs';
import { WorkspaceRestoreView } from '@/components/workspace/workspace-restore-view';
import { useAppPreferences } from '@/hooks/use-app-preferences';
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';
import { useWorkspacePageController } from '@/hooks/use-workspace-page-controller';
import { useWorkspaceRestore } from '@/hooks/use-workspace-restore';
import { usePreferencesStore } from '@/store/preferences';
import { useWorkspaceStore } from '@/store/workspace';
import { isMacDesktop } from '@/utils';

const macDesktop = isMacDesktop();

const App = (): React.JSX.Element => {
  const { sessionSidebarCollapsed, setSidebarCollapsed } = useWorkspaceStore(
    useShallow((state) => ({
      sessionSidebarCollapsed: state.sidebarCollapsed,
      setSidebarCollapsed: state.setSidebarCollapsed,
    })),
  );
  const sidebarCollapsed = sessionSidebarCollapsed ?? false;
  const [sidebarPeek, setSidebarPeek] = useState(false);
  const [sidebarPeekEnabled, setSidebarPeekEnabled] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'general' | 'model'>('general');
  const theme = usePreferencesStore((state) => state.theme);
  useAppPreferences();
  const workspaceReady = useWorkspaceRestore();
  const [isHomeProjectModalOpen, setIsHomeProjectModalOpen] = useState(false);
  const sidebarVisible = !sidebarCollapsed || sidebarPeek;

  const collapseSidebar = (): void => {
    setSidebarCollapsed(true);
    setSidebarPeek(false);
    setSidebarPeekEnabled(false);
  };

  const pinSidebarOpen = (): void => {
    setSidebarCollapsed(false);
    setSidebarPeek(false);
    setSidebarPeekEnabled(true);
  };

  const pages = useWorkspacePageController({
    onEnterEdit: () => {
      collapseSidebar();
      setSidebarPeekEnabled(true);
    },
    onEnterChat: pinSidebarOpen,
    onPageSelected: () => setSidebarPeek(false),
  });

  const openSettings = useCallback((): void => {
    setSidebarPeek(false);
    setSettingsSection('general');
    setIsSettingsOpen(true);
  }, []);

  const openModelSettings = (): void => {
    setSidebarPeek(false);
    setSettingsSection('model');
    setIsSettingsOpen(true);
  };

  const closeSettings = (): void => {
    setIsSettingsOpen(false);
  };

  useGlobalShortcuts(openSettings);

  const sidebar = (
    <Sidebar
      onPin={pinSidebarOpen}
      onTemporaryClose={() => setSidebarPeek(false)}
      onOpenSettings={openSettings}
      flushEditor={pages.flushEditor}
      onPageCreated={pages.addPage}
      onSelectPage={(pageId) => void pages.transition(() => pages.selectPage(pageId))}
    />
  );
  return (
    <TooltipProvider>
      <main
        className='flex h-full w-full overflow-hidden bg-white text-[13px] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100'
        data-theme={theme}
      >
        {sidebarVisible && sidebar}
        {pages.transitionError && (
          <div
            role='alert'
            className='fixed bottom-4 left-1/2 z-50 rounded-lg bg-danger p-3 text-danger-foreground'
          >
            操作未完成：{pages.transitionError}。编辑内容已保留，请重试。
          </div>
        )}
        <button
          type='button'
          className={`window-no-drag-region fixed top-1.5 z-30 h-7 min-h-7 w-7 min-w-7 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${
            macDesktop ? 'left-21' : 'left-1.5'
          } grid cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-primary`}
          onMouseEnter={() => sidebarCollapsed && sidebarPeekEnabled && setSidebarPeek(true)}
          onMouseLeave={() => sidebarCollapsed && setSidebarPeekEnabled(true)}
          onClick={sidebarCollapsed ? pinSidebarOpen : collapseSidebar}
          aria-expanded={sidebarPeek}
          aria-controls='project-sidebar'
          aria-label={
            sidebarCollapsed ? (sidebarPeek ? '固定展开侧边栏' : '展开侧边栏') : '收起侧边栏'
          }
        >
          {sidebarCollapsed ? <PanelLeft size={17} /> : <PanelLeftClose size={17} />}
        </button>

        {!workspaceReady ? (
          <WorkspaceRestoreView />
        ) : (
          <section className='flex min-w-0 flex-1 flex-col'>
            <PageTabs
              onSelect={(pageId) => void pages.transition(() => pages.selectPage(pageId))}
              onClose={(pageId) => void pages.transition(() => pages.closePage(pageId))}
            />
            <Workspace
              editorRefForPage={pages.editorRefForPage}
              onModeChange={pages.changeMode}
              onPreview={pages.openPreview}
              onConfigureModel={openModelSettings}
              onCreateProject={() => setIsHomeProjectModalOpen(true)}
            />
          </section>
        )}

        <SettingsModal
          isOpen={isSettingsOpen}
          initialSection={settingsSection}
          onClose={closeSettings}
        />

        <CreateProjectModal
          isOpen={isHomeProjectModalOpen}
          onClose={() => setIsHomeProjectModalOpen(false)}
        />
      </main>
    </TooltipProvider>
  );
};

export default App;
