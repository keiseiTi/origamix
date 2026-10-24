import { create } from 'zustand';

// A completed upgrade invalidates page lifecycle projections without resetting editor drafts.
export const useProjectUpgrades = create<{
  completed: Record<string, number>;
  notifyCompleted: (projectId: string) => void;
}>((set) => ({
  completed: {},
  notifyCompleted: (projectId) =>
    set((state) => ({
      completed: { ...state.completed, [projectId]: (state.completed[projectId] ?? 0) + 1 },
    })),
}));
