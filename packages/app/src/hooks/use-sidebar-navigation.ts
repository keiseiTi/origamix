import { useCallback, useState } from 'react';
import { usePreferencesStore } from '@/store/preferences';

export const useSidebarNavigation = () => {
  const sidebarCollapsed = usePreferencesStore((state) => state.sidebarCollapsed);
  const [sidebarPeek, setSidebarPeek] = useState(false);
  const [sidebarPeekEnabled, setSidebarPeekEnabled] = useState(true);

  const closePeek = useCallback((): void => setSidebarPeek(false), []);
  const collapse = useCallback((): void => {
    usePreferencesStore.getState().setSidebarCollapsed(true);
    setSidebarPeek(false);
    setSidebarPeekEnabled(false);
  }, []);
  const pinOpen = useCallback((): void => {
    usePreferencesStore.getState().setSidebarCollapsed(false);
    setSidebarPeek(false);
    setSidebarPeekEnabled(true);
  }, []);

  return {
    visible: !sidebarCollapsed || sidebarPeek,
    peek: sidebarPeek,
    closePeek,
    collapse,
    pinOpen,
    onToggleMouseEnter: (): void => {
      if (sidebarCollapsed && sidebarPeekEnabled) setSidebarPeek(true);
    },
    onToggleMouseLeave: (): void => {
      if (sidebarCollapsed) setSidebarPeekEnabled(true);
    },
  };
};
