import { TooltipProvider } from '@origamix/ui/tooltip';
import { useCallback, useRef, useState } from 'react';
import {
  SidebarNavigation,
  type SidebarNavigationHandle,
} from '@/components/sidebar/sidebar-navigation';
import { CreateProjectModal } from '@/components/sidebar/mod/create-project-modal';
import { SettingsModal } from '@/components/settings';
import { Workspace } from '@/components/workspace';
import { useAppPreferences } from '@/hooks/use-app-preferences';
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';
import { useWorkspacePageController } from '@/hooks/use-workspace-page-controller';
import { AppLayout } from '@/components/app-layout';

const App = (): React.JSX.Element => {
  const sidebarRef = useRef<SidebarNavigationHandle>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'general' | 'model'>('general');
  const [isHomeProjectModalOpen, setIsHomeProjectModalOpen] = useState(false);

  useAppPreferences();

  const pages = useWorkspacePageController({
    onPageSelected: () => sidebarRef.current?.closePeek(),
  });

  const openSettings = useCallback((): void => {
    sidebarRef.current?.closePeek();
    setSettingsSection('general');
    setIsSettingsOpen(true);
  }, []);

  const openModelSettings = (): void => {
    sidebarRef.current?.closePeek();
    setSettingsSection('model');
    setIsSettingsOpen(true);
  };

  const closeSettings = (): void => {
    setIsSettingsOpen(false);
  };

  useGlobalShortcuts(openSettings);

  return (
    <TooltipProvider>
      <AppLayout
        sidebar={
          <SidebarNavigation
            ref={sidebarRef}
            onOpenSettings={openSettings}
            flushEditor={pages.flushEditor}
            onPageCreated={pages.addPage}
            onSelectPage={(pageId) => void pages.transition(() => pages.selectPage(pageId))}
          />
        }
      >
        <Workspace
          onSelectPage={(pageId) => void pages.transition(() => pages.selectPage(pageId))}
          onClosePage={(pageId) => void pages.transition(() => pages.closePage(pageId))}
          transitionError={pages.transitionError}
          editorRefForPage={pages.editorRefForPage}
          onModeChange={pages.changeMode}
          onPreview={pages.openPreview}
          onConfigureModel={openModelSettings}
          onCreateProject={() => setIsHomeProjectModalOpen(true)}
        />
      </AppLayout>

      <SettingsModal
        isOpen={isSettingsOpen}
        initialSection={settingsSection}
        onClose={closeSettings}
      />

      <CreateProjectModal
        isOpen={isHomeProjectModalOpen}
        onClose={() => setIsHomeProjectModalOpen(false)}
      />
    </TooltipProvider>
  );
};

export default App;
