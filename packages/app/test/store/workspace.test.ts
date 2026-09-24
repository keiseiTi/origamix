// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { parseWorkspaceSession, useWorkspaceStore } from '../../src/store/workspace';

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
        activePageId: 'page_a',
        openPageIds: ['page_a', 'page_b'],
        pageModes: { page_a: 'edit', page_b: 'chat' },
        pageDrafts: { page_a: 'retained draft', removed: 'stale' },
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
    expect(restored.pageDrafts[activePage!.id]).toBe('retained draft');
    expect(restored.pageDrafts).not.toHaveProperty('removed');
  });
});
