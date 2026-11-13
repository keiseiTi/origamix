import { create } from 'zustand';
import type { EditorHandle } from '@origamix/editor';

export type WorkspaceMode = 'chat' | 'edit' | 'preview';
export type PageLifecycleStatus =
  'in_sync' | 'draft_unsaved' | 'saved_pending_apply' | 'external_change';

export const projectSettingsTabId = (projectId: string): string => `project-settings:${projectId}`;

export interface PageItem {
  kind?: 'page' | 'project-settings';
  id: string;
  name: string;
  fileName: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  path: string;
  pages: PageItem[];
  runtime?: 'origamix' | 'external';
  layoutEnabled?: boolean;
}

export interface OpenPageTab extends PageItem {
  projectId: string;
  mode: WorkspaceMode;
  // Null means the Server has not established the current lifecycle status yet.
  status: PageLifecycleStatus | null;
}

export interface WorkspaceSession {
  activeTabId: string | null;
  openPages: OpenPageTab[];
  pageDrafts: Record<string, string>;
}

interface WorkspaceState extends WorkspaceSession {
  projects: ProjectItem[];
  workspaceReady: boolean;
  workspaceError: string | null;
  transitionError: string | null;
  setProjects: (update: ProjectItem[] | ((projects: ProjectItem[]) => ProjectItem[])) => void;
  restoreWorkspace: (projects: ProjectItem[]) => void;
  failWorkspaceRestore: (message: string) => void;
  selectPage: (pageId: string) => void;
  closePage: (pageId: string) => void;
  removePages: (pageIds: Iterable<string>) => void;
  changePageMode: (pageId: string, mode: WorkspaceMode) => Promise<void>;
  setPageStatus: (pageId: string, status: PageLifecycleStatus | null) => void;
  setPageDraft: (pageId: string, draft: string) => void;
  replaceWorkspace: (session: Partial<WorkspaceSession>) => void;
}

const storageKey = 'origamix:view-session';
const emptySession: WorkspaceSession = {
  activeTabId: null,
  openPages: [],
  pageDrafts: {},
};
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
          typeof tab.fileName !== 'string' ||
          (tab.kind === 'project-settings' && tab.id !== projectSettingsTabId(tab.projectId))
        )
          continue;
        seen.add(tab.id);
        openPages.push({
          id: tab.id,
          projectId: tab.projectId,
          name: tab.name,
          fileName: tab.fileName,
          mode:
            tab.kind === 'project-settings'
              ? 'chat'
              : isMode(tab.mode) && tab.mode !== 'preview'
                ? tab.mode
                : 'chat',
          ...(tab.kind === 'project-settings'
            ? { kind: 'project-settings' as const, name: '布局配置' }
            : {}),
          status: null,
        });
      }
    }
    const activeTabId = typeof record.activeTabId === 'string' ? record.activeTabId : null;
    return {
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

export const pageLocation = (projects: ProjectItem[], pageId: string) => {
  for (const project of projects) {
    if (
      pageId === projectSettingsTabId(project.id) &&
      project.runtime !== 'external' &&
      project.layoutEnabled !== false
    )
      return {
        project,
        page: { id: pageId, name: '布局配置', fileName: '', kind: 'project-settings' as const },
      };
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
            ...(location.page.kind ? { kind: location.page.kind } : {}),
          },
        ]
      : [];
  });

const withoutDrafts = (drafts: Record<string, string>, keptIds: Set<string>) =>
  Object.fromEntries(Object.entries(drafts).filter(([id]) => keptIds.has(id)));

const editorRefs = new Map<string, { current: EditorHandle | null }>();

export const editorRefForPage = (pageId: string): { current: EditorHandle | null } => {
  let ref = editorRefs.get(pageId);
  if (!ref) {
    ref = { current: null };
    editorRefs.set(pageId, ref);
  }
  return ref;
};

export const flushEditor = async (
  pageId = useWorkspaceStore.getState().activeTabId,
): Promise<void> => {
  if (pageId) await editorRefs.get(pageId)?.current?.flush();
};

let transitionPending = false;
export const runWorkspaceTransition = async (
  pageId: string,
  action: () => void,
  targetOnly = false,
): Promise<void> => {
  if (transitionPending) return;
  transitionPending = true;
  const { activeTabId } = useWorkspaceStore.getState();
  const pageIds = targetOnly ? [pageId] : new Set([activeTabId, pageId]);
  try {
    useWorkspaceStore.setState({ transitionError: null });
    for (const id of pageIds) {
      if (id) await flushEditor(id);
    }
    action();
  } catch (reason) {
    useWorkspaceStore.setState({
      transitionError: reason instanceof Error ? reason.message : '保存失败，请重试',
    });
  } finally {
    transitionPending = false;
  }
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  ...readSession(),
  projects: [],
  workspaceReady: false,
  workspaceError: null,
  transitionError: null,
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
          new Set(projects.flatMap((project) => [...project.pages.map((page) => page.id)])),
        ),
      };
    }),
  failWorkspaceRestore: (workspaceError) => set({ workspaceError }),
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
  changePageMode: async (pageId, mode) => {
    const target = get().openPages.find((tab) => tab.id === pageId);
    if (!target || target.kind === 'project-settings' || target.mode === mode) return;
    await runWorkspaceTransition(
      pageId,
      () =>
        set((state) => {
          const current = state.openPages.find((tab) => tab.id === pageId);
          if (!current || current.projectId !== target.projectId) return state;
          return {
            openPages: state.openPages.map((tab) => (tab === current ? { ...tab, mode } : tab)),
          };
        }),
      mode === 'preview',
    );
  },
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

useWorkspaceStore.subscribe((state, previous) => {
  if (state.openPages !== previous.openPages) {
    const openIds = new Set(state.openPages.map((tab) => tab.id));
    for (const pageId of editorRefs.keys()) {
      if (!openIds.has(pageId)) editorRefs.delete(pageId);
    }
  }
  if (
    state.openPages === previous.openPages &&
    state.activeTabId === previous.activeTabId &&
    state.pageDrafts === previous.pageDrafts
  )
    return;
  try {
    const session: WorkspaceSession = {
      activeTabId: state.activeTabId,
      openPages: state.openPages.map((tab) => ({ ...tab, status: null })),
      pageDrafts: state.pageDrafts,
    };
    sessionStorage.setItem(storageKey, JSON.stringify(session));
  } catch {
    // Keep navigation usable when session storage is unavailable.
  }
});
