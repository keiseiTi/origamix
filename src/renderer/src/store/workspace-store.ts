import { create } from 'zustand';

export type AgentStatus =
  'idle' | 'connecting' | 'generating' | 'validating' | 'committing' | 'failed';

interface WorkspaceState {
  activePageId: string;
  selectedElementId: string | null;
  currentRevisionId: string | null;
  agentStatus: AgentStatus;
  selectPage: (pageId: string) => void;
  selectElement: (elementId: string | null) => void;
  setRevision: (revisionId: string) => void;
  setAgentStatus: (status: AgentStatus) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activePageId: 'page_customer_list',
  selectedElementId: null,
  currentRevisionId: null,
  agentStatus: 'idle',
  selectPage: (activePageId) => set({ activePageId, selectedElementId: null }),
  selectElement: (selectedElementId) => set({ selectedElementId }),
  setRevision: (currentRevisionId) => set({ currentRevisionId }),
  setAgentStatus: (agentStatus) => set({ agentStatus })
}));
