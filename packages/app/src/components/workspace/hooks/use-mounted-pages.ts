import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from '@/store/workspace';

export const useMountedPages = (): string[] => {
  const { openPages, activeTabId } = useWorkspaceStore(
    useShallow((state) => ({ openPages: state.openPages, activeTabId: state.activeTabId })),
  );
  const [visitedPageIds, setVisitedPageIds] = useState<string[]>(() => {
    const initial = useWorkspaceStore.getState().activeTabId;
    return initial ? [initial] : [];
  });
  const openIds = new Set(openPages.map((page) => page.id));
  const mountedIds = visitedPageIds.filter((id) => openIds.has(id));
  if (activeTabId && openIds.has(activeTabId) && !mountedIds.includes(activeTabId)) {
    mountedIds.push(activeTabId);
  }

  useEffect(() => {
    return useWorkspaceStore.subscribe((state, previous) => {
      if (state.openPages === previous.openPages && state.activeTabId === previous.activeTabId)
        return;
      const nextOpenIds = new Set(state.openPages.map((page) => page.id));
      setVisitedPageIds((current) => {
        const next = current.filter((id) => nextOpenIds.has(id));
        if (
          state.activeTabId &&
          nextOpenIds.has(state.activeTabId) &&
          !next.includes(state.activeTabId)
        ) {
          next.push(state.activeTabId);
        }
        return next.length === current.length && next.every((id, index) => id === current[index])
          ? current
          : next;
      });
    });
  }, []);

  return mountedIds;
};
