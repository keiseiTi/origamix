// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { useMountedPages } from '../../../../src/components/workspace/hooks/use-mounted-pages';
import { useWorkspaceStore } from '../../../../src/store/workspace';

afterEach(cleanup);

it('mounts the first page opened by a project flow and retains visited tabs until closed', () => {
  useWorkspaceStore.setState({ projects: [], openPages: [], activeTabId: null, pageDrafts: {} });
  const { result } = renderHook(() => useMountedPages());
  expect(result.current).toEqual([]);

  act(() => {
    useWorkspaceStore.getState().setProjects([
      {
        id: 'project',
        name: 'Project',
        path: '/project',
        pages: [
          { id: 'first', name: 'First', fileName: 'first' },
          { id: 'second', name: 'Second', fileName: 'second' },
        ],
      },
    ]);
    useWorkspaceStore.getState().replaceWorkspace({
      openPages: [
        {
          id: 'first',
          projectId: 'project',
          name: 'First',
          fileName: 'first',
          mode: 'chat',
          status: null,
        },
      ],
      activeTabId: 'first',
    });
  });
  expect(result.current).toEqual(['first']);

  act(() => useWorkspaceStore.getState().selectPage('second'));
  expect(result.current).toEqual(['first', 'second']);

  act(() => useWorkspaceStore.getState().closePage('first'));
  expect(result.current).toEqual(['second']);
});
