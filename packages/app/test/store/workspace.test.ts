// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { parseWorkspaceSession, useWorkspaceStore } from '@/store/workspace';

const projects = [
  {
    id: 'project_1',
    name: 'Project',
    path: '/project',
    pages: [
      { id: 'page_a', name: 'First', fileName: 'first' },
      { id: 'page_b', name: 'Second', fileName: 'second' },
    ],
  },
];

describe('workspace tab recovery', () => {
  it('restores the active page and its retained draft without trusting stale lifecycle state', () => {
    const session = parseWorkspaceSession(
      JSON.stringify({
        activeTabId: 'page_a',
        openPages: [
          ...projects[0].pages.map((page) => ({
            ...page,
            projectId: 'project_1',
            mode: page.id === 'page_a' ? 'edit' : 'chat',
            status: 'in_sync',
          })),
        ],
        conversationDrafts: {
          page_a: { conversation_1: 'retained draft' },
          removed: { '': 'stale' },
        },
      }),
    );
    useWorkspaceStore.setState({ ...session, projects: [], workspaceReady: false });
    useWorkspaceStore.getState().restoreWorkspace(projects);

    const restored = useWorkspaceStore.getState();
    const activePage = restored.openPages.find((tab) => tab.id === restored.activeTabId);
    expect(activePage).toMatchObject({
      id: 'page_a',
      projectId: 'project_1',
      mode: 'edit',
      status: null,
    });
    expect(restored.conversationDrafts[activePage!.id]?.conversation_1).toBe('retained draft');
    expect(restored.conversationDrafts).not.toHaveProperty('removed');
  });
});
