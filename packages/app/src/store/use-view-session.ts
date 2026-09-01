import { useCallback, useEffect, useState } from 'react';
import type { WorkspaceMode } from '../components/workspace';
import { parseSession, restoreSidebar, type ViewSession } from './view-session';

const storageKey = 'origamix:view-session';

function readSession(): ViewSession {
  try {
    return parseSession(sessionStorage.getItem(storageKey));
  } catch {
    return { activeTab: 'chat', isSettingsOpen: false };
  }
}

export function useViewSession(): ViewSession & {
  setActiveTab: (activeTab: WorkspaceMode) => void;
  setIsSettingsOpen: (isSettingsOpen: boolean) => void;
  setSidebarCollapsed: (sidebarCollapsed: boolean) => void;
  restoreSidebarCollapsed: (sidebarCollapsed: boolean) => void;
} {
  const [state, setState] = useState<ViewSession>(readSession);
  const restoreSidebarCollapsed = useCallback((sidebarCollapsed: boolean) => {
    // The current window's state takes precedence over an older server snapshot.
    setState((current) => restoreSidebar(current, sidebarCollapsed));
  }, []);

  useEffect(() => {
    try {
      // sessionStorage survives reloads but is discarded when the window closes.
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Keep navigation usable if session storage is unavailable.
    }
  }, [state]);

  return {
    ...state,
    restoreSidebarCollapsed,
    setSidebarCollapsed: (sidebarCollapsed) =>
      setState((current) => ({ ...current, sidebarCollapsed })),
    setActiveTab: (activeTab) => setState((current) => ({ ...current, activeTab })),
    setIsSettingsOpen: (isSettingsOpen) => setState((current) => ({ ...current, isSettingsOpen })),
  };
}
