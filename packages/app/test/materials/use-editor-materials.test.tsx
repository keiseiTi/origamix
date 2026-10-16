// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BUILTIN_PROJECT_STACK } from '@origamix/shared/protocol/project-stack';
import type { EditorMaterialRegistration } from '@origamix/editor/contracts';

const mocks = vi.hoisted(() => ({ stack: vi.fn(), load: vi.fn() }));
vi.mock('../../src/services/projects', () => ({ projectsService: { stack: mocks.stack } }));
vi.mock('../../src/materials/loaders', () => ({ loadEditorMaterials: mocks.load }));
import { useEditorMaterials } from '../../src/materials/use-editor-materials';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

// Server cannot prove that late browser imports never install another project's
// material registration, or that a rejected import remains explicitly retryable.
it('ignores late material loads from another project and retries a failed current load', async () => {
  let resolveOld!: (registration: EditorMaterialRegistration) => void;
  const oldRegistration = {
    catalog: {
      formatVersion: '1.0',
      materialSet: BUILTIN_PROJECT_STACK.materialSet,
      materials: [],
    },
    groups: [],
    propertyEditors: [],
  } as EditorMaterialRegistration;
  const currentRegistration = { ...oldRegistration };
  mocks.stack.mockResolvedValue(BUILTIN_PROJECT_STACK);
  mocks.load
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    )
    .mockRejectedValueOnce(new Error('chunk unavailable'))
    .mockResolvedValueOnce(currentRegistration);
  const hook = renderHook(({ projectId }) => useEditorMaterials(projectId, true), {
    initialProps: { projectId: 'project_old' },
  });
  await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(1));
  hook.rerender({ projectId: 'project_current' });
  await waitFor(() => expect(hook.result.current.error).toBe('chunk unavailable'));
  await act(async () => {
    resolveOld(oldRegistration);
  });
  expect(hook.result.current.registration).toBeUndefined();
  expect(hook.result.current.error).toBe('chunk unavailable');
  act(() => hook.result.current.retry());
  await waitFor(() => expect(hook.result.current.registration).toBe(currentRegistration));
  expect(mocks.stack).toHaveBeenLastCalledWith('project_current');
  expect(hook.result.current.error).toBeUndefined();
});
