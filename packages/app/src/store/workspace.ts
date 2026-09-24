import { create } from 'zustand';

export type WorkspaceMode = 'chat' | 'edit' | 'preview';
export type PageLifecycleStatus =
  'in_sync' | 'draft_unsaved' | 'saved_pending_apply' | 'external_change';

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

export interface OpenPageTab extends PageItem {
  projectId: string;
  mode: WorkspaceMode;
  // Null means the Server has not established the current lifecycle status yet.
  status: PageLifecycleStatus | null;
}

export interface WorkspaceSession {
  sidebarCollapsed?: boolean;
  activeTabId: string | null;
  openPages: OpenPageTab[];
  pageDrafts: Record<string, string>;
}

interface WorkspaceState extends WorkspaceSession {
  projects: ProjectItem[];
  workspaceReady: boolean;
  workspaceError: string | null;
  setProjects: (update: ProjectItem[] | ((projects: ProjectItem[]) => ProjectItem[])) => void;
  restoreWorkspace: (projects: ProjectItem[]) => void;
  failWorkspaceRestore: (message: string) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  restoreSidebarCollapsed: (collapsed: boolean) => void;
  selectPage: (pageId: string) => void;
  closePage: (pageId: string) => void;
  removePages: (pageIds: Iterable<string>) => void;
  setPageMode: (pageId: string, mode: WorkspaceMode) => void;
  setPageStatus: (pageId: string, status: PageLifecycleStatus | null) => void;
  setPageDraft: (pageId: string, draft: string) => void;
  replaceWorkspace: (session: Partial<WorkspaceSession>) => void;
}

const storageKey = 'origamix:view-session';
const emptySession: WorkspaceSession = { activeTabId: null, openPages: [], pageDrafts: {} };
const isMode = (value: unknown): value is WorkspaceMode =>
  value === 'chat' || value === 'edit' || value === 'preview';

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
    const openPages: OpenPageTab[] = [];
    const seen = new Set<string>();
    if (Array.isArray(record.openPages)) {
      for (const value of record.openPages) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
        const tab = value as Record<string, unknown>;
        if (
          typeof tab.id !== 'string' ||
          !tab.id ||
          seen.has(tab.id) ||
          typeof tab.projectId !== 'string' ||
          typeof tab.name !== 'string' ||
          typeof tab.fileName !== 'string'
        )
          continue;
        seen.add(tab.id);
        openPages.push({
          id: tab.id,
          projectId: tab.projectId,
          name: tab.name,
          fileName: tab.fileName,
          mode: isMode(tab.mode) && tab.mode !== 'preview' ? tab.mode : 'chat',
          status: null,
        });
      }
    } else {
      // Migrate existing window sessions without retaining stale project metadata.
      const modes = stringRecord(record.pageModes);
      for (const id of stringArray(record.openPageIds)) {
        openPages.push({
          id,
          projectId: '',
          name: '',
          fileName: '',
          mode: modes[id] === 'edit' ? 'edit' : 'chat',
          status: null,
        });
      }
    }
    const activeTabId =
      typeof record.activeTabId === 'string'
        ? record.activeTabId
        : typeof record.activePageId === 'string'
          ? record.activePageId
          : null;
    return {
      sidebarCollapsed:
        typeof record.sidebarCollapsed === 'boolean' ? record.sidebarCollapsed : undefined,
      activeTabId,
      openPages,
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

const pageLocation = (projects: ProjectItem[], pageId: string) => {
  for (const project of projects) {
    const page = project.pages.find((item) => item.id === pageId);
    if (page) return { project, page };
  }
  return null;
};

const reconcileTabs = (projects: ProjectItem[], tabs: OpenPageTab[]): OpenPageTab[] =>
  tabs.flatMap((tab) => {
    const location = pageLocation(projects, tab.id);
    return location
      ? [
          {
            ...tab,
            projectId: location.project.id,
            name: location.page.name,
            fileName: location.page.fileName,
          },
        ]
      : [];
  });

const withoutDrafts = (drafts: Record<string, string>, keptIds: Set<string>) =>
  Object.fromEntries(Object.entries(drafts).filter(([id]) => keptIds.has(id)));

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  ...readSession(),
  projects: [],
  workspaceReady: false,
  workspaceError: null,
  setProjects: (update) =>
    set((state) => {
      const projects = typeof update === 'function' ? update(state.projects) : update;
      return { projects, openPages: reconcileTabs(projects, state.openPages) };
    }),
  restoreWorkspace: (projects) =>
    set((state) => {
      const openPages = reconcileTabs(projects, state.openPages);
      const activeLocation = state.activeTabId ? pageLocation(projects, state.activeTabId) : null;
      if (activeLocation && !openPages.some((tab) => tab.id === state.activeTabId)) {
        openPages.push({
          ...activeLocation.page,
          projectId: activeLocation.project.id,
          mode: 'chat',
          status: null,
        });
      }
      return {
        projects,
        workspaceReady: true,
        workspaceError: null,
        activeTabId: activeLocation ? state.activeTabId : null,
        openPages,
        pageDrafts: withoutDrafts(
          state.pageDrafts,
          new Set(projects.flatMap((project) => project.pages.map((page) => page.id))),
        ),
      };
    }),
  failWorkspaceRestore: (workspaceError) => set({ workspaceError }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  restoreSidebarCollapsed: (sidebarCollapsed) =>
    set((state) => (state.sidebarCollapsed === undefined ? { sidebarCollapsed } : state)),
  selectPage: (pageId) =>
    set((state) => {
      const location = pageLocation(state.projects, pageId);
      if (!location) return state;
      const openPages = state.openPages.some((tab) => tab.id === pageId)
        ? state.openPages
        : [
            ...state.openPages,
            {
              ...location.page,
              projectId: location.project.id,
              mode: 'chat' as const,
              status: null,
            },
          ];
      return { activeTabId: pageId, openPages };
    }),
  closePage: (pageId) =>
    set((state) => {
      const index = state.openPages.findIndex((tab) => tab.id === pageId);
      if (index < 0) return state;
      const openPages = state.openPages.filter((tab) => tab.id !== pageId);
      const { [pageId]: _removed, ...pageDrafts } = state.pageDrafts;
      void _removed;
      return {
        openPages,
        pageDrafts,
        activeTabId:
          state.activeTabId === pageId
            ? (openPages[Math.min(index, openPages.length - 1)]?.id ?? null)
            : state.activeTabId,
      };
    }),
  removePages: (pageIds) =>
    set((state) => {
      const removed = new Set(pageIds);
      const openPages = state.openPages.filter((tab) => !removed.has(tab.id));
      return {
        openPages,
        pageDrafts: Object.fromEntries(
          Object.entries(state.pageDrafts).filter(([id]) => !removed.has(id)),
        ),
        activeTabId:
          state.activeTabId && !removed.has(state.activeTabId)
            ? state.activeTabId
            : (openPages[0]?.id ?? null),
      };
    }),
  setPageMode: (pageId, mode) =>
    set((state) => ({
      openPages: state.openPages.map((tab) => (tab.id === pageId ? { ...tab, mode } : tab)),
    })),
  setPageStatus: (pageId, status) =>
    set((state) => {
      const tab = state.openPages.find((item) => item.id === pageId);
      if (!tab || tab.status === status) return state;
      return {
        openPages: state.openPages.map((item) => (item.id === pageId ? { ...item, status } : item)),
      };
    }),
  setPageDraft: (pageId, draft) =>
    set((state) => ({ pageDrafts: { ...state.pageDrafts, [pageId]: draft } })),
  replaceWorkspace: (session) => set(session),
}));

useWorkspaceStore.subscribe((state) => {
  try {
    const session: WorkspaceSession = {
      activeTabId: state.activeTabId,
      sidebarCollapsed: state.sidebarCollapsed,
      openPages: state.openPages.map((tab) => ({ ...tab, status: null })),
      pageDrafts: state.pageDrafts,
    };
    sessionStorage.setItem(storageKey, JSON.stringify(session));
  } catch {
    // Keep navigation usable when session storage is unavailable.
  }
});
