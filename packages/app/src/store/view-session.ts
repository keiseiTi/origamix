export interface ViewSession {
  activeTab: 'chat' | 'edit';
  isSettingsOpen: boolean;
  sidebarCollapsed?: boolean;
}

export function parseSession(raw: string | null): ViewSession {
  try {
    const value = JSON.parse(raw ?? 'null');
    return {
      activeTab: value?.activeTab === 'edit' ? 'edit' : 'chat',
      isSettingsOpen: value?.isSettingsOpen === true,
      sidebarCollapsed:
        typeof value?.sidebarCollapsed === 'boolean' ? value.sidebarCollapsed : undefined,
    };
  } catch {
    return { activeTab: 'chat', isSettingsOpen: false };
  }
}

export function restoreSidebar(state: ViewSession, collapsed: boolean): ViewSession {
  return state.sidebarCollapsed === undefined ? { ...state, sidebarCollapsed: collapsed } : state;
}
