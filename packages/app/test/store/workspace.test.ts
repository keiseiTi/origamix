import { beforeEach, describe, expect, it } from 'vitest';
import {
  parseWorkspaceSession,
  useWorkspaceStore,
  type ProjectItem,
} from '../../src/store/workspace';

const projects: ProjectItem[] = [
  {
    id: 'project-1',
    name: 'One',
    path: '/one',
    pages: [
      { id: 'page-1', name: 'First', fileName: 'first' },
      { id: 'page-2', name: 'Second', fileName: 'second' },
    ],
  },
];

describe('workspace store', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      projects,
      workspaceReady: true,
      workspaceError: null,
      activeTab: 'chat',
      sidebarCollapsed: false,
      activeProjectId: 'project-1',
      activePageId: null,
      openPageIds: [],
      pageModes: {},
      pageDrafts: {},
    });
  });

  it.each([null, '{broken', 'null', '42'])(
    'defaults safely for missing or invalid storage: %s',
    (raw) => {
      expect(parseWorkspaceSession(raw)).toMatchObject({
        activeTab: 'chat',
        activeProjectId: null,
        activePageId: null,
        openPageIds: [],
        pageModes: {},
        pageDrafts: {},
      });
    },
  );

  it('restores navigation while sanitizing previews and invalid fields', () => {
    expect(
      parseWorkspaceSession(
        JSON.stringify({
          activeTab: 'preview',
          activeProjectId: 'project-1',
          activePageId: 'page-2',
          openPageIds: ['page-1', 'page-2', 'page-1', 3],
          pageModes: { 'page-1': 'edit', 'page-2': 'preview', bad: 3 },
          pageDrafts: { 'page-1': 'unfinished prompt', bad: false },
        }),
      ),
    ).toMatchObject({
      activeTab: 'chat',
      activeProjectId: 'project-1',
      activePageId: 'page-2',
      openPageIds: ['page-1', 'page-2'],
      pageModes: { 'page-1': 'edit', 'page-2': 'chat' },
      pageDrafts: { 'page-1': 'unfinished prompt' },
    });
  });

  it('selects and closes pages with one atomic navigation update', () => {
    useWorkspaceStore.getState().selectPage('page-1');
    useWorkspaceStore.getState().setPageMode('page-1', 'edit');
    useWorkspaceStore.getState().setPageDraft('page-1', 'draft');
    useWorkspaceStore.getState().selectPage('page-2');
    useWorkspaceStore.getState().closePage('page-2');

    expect(useWorkspaceStore.getState()).toMatchObject({
      activeProjectId: 'project-1',
      activePageId: 'page-1',
      activeTab: 'edit',
      openPageIds: ['page-1'],
      pageModes: { 'page-1': 'edit' },
      pageDrafts: { 'page-1': 'draft' },
    });
  });

  it('restores an in-session preview when its tab becomes active again', () => {
    useWorkspaceStore.getState().selectPage('page-1');
    useWorkspaceStore.getState().setPageMode('page-1', 'preview');
    useWorkspaceStore.getState().selectPage('page-2');
    useWorkspaceStore.getState().selectPage('page-1');

    expect(useWorkspaceStore.getState()).toMatchObject({
      activePageId: 'page-1',
      activeTab: 'preview',
      pageModes: { 'page-1': 'preview' },
    });
  });

  it('removes deleted pages together with their modes and drafts', () => {
    useWorkspaceStore.setState({
      activePageId: 'page-1',
      openPageIds: ['page-1', 'page-2'],
      pageModes: { 'page-1': 'edit', 'page-2': 'chat' },
      pageDrafts: { 'page-1': 'one', 'page-2': 'two' },
    });
    useWorkspaceStore.getState().removePages(['page-1']);

    expect(useWorkspaceStore.getState()).toMatchObject({
      activePageId: 'page-2',
      openPageIds: ['page-2'],
      pageModes: { 'page-2': 'chat' },
      pageDrafts: { 'page-2': 'two' },
    });
  });
});
