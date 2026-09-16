import { create } from 'zustand';

export type WorkspaceMode = 'chat' | 'edit' | 'preview';

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

export interface WorkspaceSession {
  activeTab: WorkspaceMode;
  isSettingsOpen: boolean;
  sidebarCollapsed?: boolean;
  activeProjectId: string | null;
  activePageId: string | null;
  openPageIds: string[];
  pageModes: Record<string, WorkspaceMode>;
  pageDrafts: Record<string, string>;
}

interface WorkspaceState extends WorkspaceSession {
  projects: ProjectItem[];
  workspaceReady: boolean;
  workspaceError: string | null;
  setProjects: (update: ProjectItem[] | ((projects: ProjectItem[]) => ProjectItem[])) => void;
  restoreWorkspace: (projects: ProjectItem[]) => void;
  failWorkspaceRestore: (message: string) => void;
  setActiveTab: (mode: WorkspaceMode) => void;
  setSettingsOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  restoreSidebarCollapsed: (collapsed: boolean) => void;
  selectPage: (pageId: string) => void;
  closePage: (pageId: string) => void;
  removePages: (pageIds: Iterable<string>) => void;
  setPageMode: (pageId: string, mode: WorkspaceMode) => void;
  setPageDraft: (pageId: string, draft: string) => void;
  replaceWorkspace: (session: Partial<WorkspaceSession>) => void;
}

const storageKey = 'origamix:view-session';

const emptySession: WorkspaceSession = {
  activeTab: 'chat',
  isSettingsOpen: false,
  activeProjectId: null,
  activePageId: null,
  openPageIds: [],
  pageModes: {},
  pageDrafts: {},
};

const stringRecord = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
};

const stringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string'))];
};

export const parseWorkspaceSession = (raw: string | null): WorkspaceSession => {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return emptySession;
    const record = value as Record<string, unknown>;
    const modes = stringRecord(record.pageModes);
    return {
      activeTab: record.activeTab === 'edit' ? 'edit' : 'chat',
      isSettingsOpen: record.isSettingsOpen === true,
      sidebarCollapsed:
        typeof record.sidebarCollapsed === 'boolean' ? record.sidebarCollapsed : undefined,
      activeProjectId: typeof record.activeProjectId === 'string' ? record.activeProjectId : null,
      activePageId: typeof record.activePageId === 'string' ? record.activePageId : null,
      openPageIds: stringArray(record.openPageIds),
      pageModes: Object.fromEntries(
        Object.entries(modes).map(([id, mode]) => [id, mode === 'edit' ? 'edit' : 'chat']),
      ),
      pageDrafts: stringRecord(record.pageDrafts),
    };
  } catch {
    return emptySession;
  }
};

const readSession = (): WorkspaceSession => {
  try {
    return parseWorkspaceSession(sessionStorage.getItem(storageKey));
  } catch {
    return emptySession;
  }
};

const initialSession = readSession();

const projectIdForPage = (projects: ProjectItem[], pageId: string | null): string | null =>
  projects.find((project) => project.pages.some((page) => page.id === pageId))?.id ?? null;

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  ...initialSession,
  projects: [],
  workspaceReady: false,
  workspaceError: null,
  setProjects: (update) =>
    set((state) => ({ projects: typeof update === 'function' ? update(state.projects) : update })),
  restoreWorkspace: (projects) =>
    set((state) => {
      const pageIds = new Set(projects.flatMap((project) => project.pages.map((page) => page.id)));
      const projectIds = new Set(projects.map((project) => project.id));
      const openPageIds = state.openPageIds.filter((id) => pageIds.has(id));
      const activePageId =
        state.activePageId && pageIds.has(state.activePageId) ? state.activePageId : null;
      if (activePageId && !openPageIds.includes(activePageId)) openPageIds.push(activePageId);
      const pageModes = Object.fromEntries(
        Object.entries(state.pageModes).filter(([id]) => pageIds.has(id)),
      );
      const pageDrafts = Object.fromEntries(
        Object.entries(state.pageDrafts).filter(([id]) => pageIds.has(id)),
      );
      return {
        projects,
        workspaceReady: true,
        workspaceError: null,
        activePageId,
        activeProjectId:
          projectIdForPage(projects, activePageId) ??
          (state.activeProjectId && projectIds.has(state.activeProjectId)
            ? state.activeProjectId
            : null),
        openPageIds,
        pageModes,
        pageDrafts,
        activeTab: activePageId && pageModes[activePageId] === 'edit' ? 'edit' : 'chat',
      };
    }),
  failWorkspaceRestore: (workspaceError) => set({ workspaceError }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  restoreSidebarCollapsed: (sidebarCollapsed) =>
    set((state) => (state.sidebarCollapsed === undefined ? { sidebarCollapsed } : state)),
  selectPage: (pageId) =>
    set((state) => {
      const pageModes =
        state.activePageId && state.activeTab !== 'preview'
          ? { ...state.pageModes, [state.activePageId]: state.activeTab }
          : state.pageModes;
      return {
        activeProjectId: projectIdForPage(state.projects, pageId) ?? state.activeProjectId,
        activePageId: pageId,
        openPageIds: state.openPageIds.includes(pageId)
          ? state.openPageIds
          : [...state.openPageIds, pageId],
        pageModes,
        activeTab: pageModes[pageId] === 'edit' ? 'edit' : 'chat',
      };
    }),
  closePage: (pageId) =>
    set((state) => {
      const index = state.openPageIds.indexOf(pageId);
      const openPageIds = state.openPageIds.filter((id) => id !== pageId);
      const pageModes = { ...state.pageModes };
      const pageDrafts = { ...state.pageDrafts };
      delete pageModes[pageId];
      delete pageDrafts[pageId];
      const activePageId =
        state.activePageId === pageId
          ? (openPageIds[Math.min(index, openPageIds.length - 1)] ?? null)
          : state.activePageId;
      return {
        activePageId,
        activeProjectId: projectIdForPage(state.projects, activePageId) ?? state.activeProjectId,
        openPageIds,
        pageModes,
        pageDrafts,
        activeTab:
          state.activePageId === pageId
            ? activePageId && pageModes[activePageId] === 'edit'
              ? 'edit'
              : 'chat'
            : state.activeTab,
      };
    }),
  removePages: (pageIds) =>
    set((state) => {
      const removed = new Set(pageIds);
      const openPageIds = state.openPageIds.filter((id) => !removed.has(id));
      const pageModes = Object.fromEntries(
        Object.entries(state.pageModes).filter(([id]) => !removed.has(id)),
      );
      const pageDrafts = Object.fromEntries(
        Object.entries(state.pageDrafts).filter(([id]) => !removed.has(id)),
      );
      const activePageId =
        state.activePageId && !removed.has(state.activePageId)
          ? state.activePageId
          : (openPageIds[0] ?? null);
      return {
        activePageId,
        activeProjectId: projectIdForPage(state.projects, activePageId),
        openPageIds,
        pageModes,
        pageDrafts,
        activeTab: activePageId && pageModes[activePageId] === 'edit' ? 'edit' : 'chat',
      };
    }),
  setPageMode: (pageId, mode) =>
    set((state) => ({
      pageModes: { ...state.pageModes, [pageId]: mode },
      ...(state.activePageId === pageId ? { activeTab: mode } : {}),
    })),
  setPageDraft: (pageId, draft) =>
    set((state) => ({ pageDrafts: { ...state.pageDrafts, [pageId]: draft } })),
  replaceWorkspace: (session) => set(session),
}));

useWorkspaceStore.subscribe((state) => {
  try {
    const session: WorkspaceSession = {
      activeTab: state.activeTab,
      isSettingsOpen: state.isSettingsOpen,
      sidebarCollapsed: state.sidebarCollapsed,
      activeProjectId: state.activeProjectId,
      activePageId: state.activePageId,
      openPageIds: state.openPageIds,
      pageModes: state.pageModes,
      pageDrafts: state.pageDrafts,
    };
    sessionStorage.setItem(storageKey, JSON.stringify(session));
  } catch {
    // Keep navigation usable when session storage is unavailable.
  }
});
