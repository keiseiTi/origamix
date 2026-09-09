export interface ViewSession {
  activeTab: 'chat' | 'edit' | 'preview';
  isSettingsOpen: boolean;
  sidebarCollapsed?: boolean;
  activeProjectId: string | null;
  activePageId: string | null;
  openPageIds: string[];
  pageModes: Record<string, 'chat' | 'edit' | 'preview'>;
  pageDrafts: Record<string, string>;
}

const emptySession: ViewSession = {
  activeTab: 'chat',
  isSettingsOpen: false,
  activeProjectId: null,
  activePageId: null,
  openPageIds: [],
  pageModes: {},
  pageDrafts: {},
};

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string'))];
}

export function parseSession(raw: string | null): ViewSession {
  try {
    const value = JSON.parse(raw ?? 'null');
    const modes = stringRecord(value?.pageModes);
    return {
      activeTab: value?.activeTab === 'edit' ? value.activeTab : 'chat',
      isSettingsOpen: value?.isSettingsOpen === true,
      sidebarCollapsed:
        typeof value?.sidebarCollapsed === 'boolean' ? value.sidebarCollapsed : undefined,
      activeProjectId: typeof value?.activeProjectId === 'string' ? value.activeProjectId : null,
      activePageId: typeof value?.activePageId === 'string' ? value.activePageId : null,
      openPageIds: stringArray(value?.openPageIds),
      pageModes: Object.fromEntries(
        Object.entries(modes).map(([id, mode]) => [id, mode === 'edit' ? 'edit' : 'chat']),
      ),
      pageDrafts: stringRecord(value?.pageDrafts),
    };
  } catch {
    return emptySession;
  }
}

export function restoreSidebar(state: ViewSession, collapsed: boolean): ViewSession {
  return state.sidebarCollapsed === undefined ? { ...state, sidebarCollapsed: collapsed } : state;
}
