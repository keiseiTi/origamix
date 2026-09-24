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
  it('migrates an older session and keeps each page mode and lifecycle projection isolated', () => {
    const session = parseWorkspaceSession(
      JSON.stringify({
        activePageId: 'page_a',
        openPageIds: ['page_a', 'page_b'],
        pageModes: { page_a: 'edit', page_b: 'chat' },
        pageDrafts: { page_a: 'draft', removed: 'stale' },
      }),
    );
    useWorkspaceStore.setState({ ...session, projects: [], workspaceReady: false });
    useWorkspaceStore.getState().restoreWorkspace(projects);

    const restored = useWorkspaceStore.getState();
    expect(restored.activeTabId).toBe('page_a');
    expect(restored.openPages).toMatchObject([
      { id: 'page_a', projectId: 'project_1', name: 'First', mode: 'edit', status: null },
      { id: 'page_b', projectId: 'project_1', name: 'Second', mode: 'chat', status: null },
    ]);
    expect(restored.pageDrafts).toEqual({ page_a: 'draft' });

    restored.setPageStatus('page_a', 'draft_unsaved');
    restored.selectPage('page_b');
    expect(useWorkspaceStore.getState().openPages).toMatchObject([
      { id: 'page_a', mode: 'edit', status: 'draft_unsaved' },
      { id: 'page_b', mode: 'chat', status: null },
    ]);
    useWorkspaceStore.getState().closePage('page_a');
    expect(useWorkspaceStore.getState().pageDrafts).toEqual({});
  });
});
