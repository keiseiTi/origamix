// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ProjectSettings } from '@origamix/shared';
const mocks = vi.hoisted(() => ({ settings: vi.fn(), updateSettings: vi.fn() }));
vi.mock('../../../src/services/projects', () => ({ projectsService: mocks }));
import { ApiRequestError } from '../../../src/services/request';
import { useProjectSettingsSession } from '../../../src/components/project-settings/use-project-settings-session';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const settings: ProjectSettings = {
  projectId: 'project_test',
  name: 'Test',
  pages: [],
  manifestHash: 'a'.repeat(64),
  layout: { enabled: true, initialVariant: 'mix' },
  routing: { mode: 'browser', basePath: '/' },
  shell: { title: '', logo: '', standalonePageIds: [] },
};

it('retains local edits after a settings conflict and explicitly saves against the reviewed manifest', async () => {
  mocks.settings.mockResolvedValue(settings);
  const hook = renderHook(() => useProjectSettingsSession(settings.projectId));
  await act(async () => undefined);
  act(() => {
    hook.result.current.setDraft({ ...settings, shell: { ...settings.shell, title: '手工修改' } });
  });
  mocks.updateSettings.mockRejectedValueOnce(new ApiRequestError('保存冲突', 409, 409));
  await act(async () => {
    await hook.result.current.save();
  });
  expect(hook.result.current.draft?.shell.title).toBe('手工修改');
  expect(hook.result.current.error).toBe('保存冲突');
  const latest = {
    ...settings,
    manifestHash: 'b'.repeat(64),
    pages: [{ pageId: 'page_new', name: 'New', slug: 'new' }],
    shell: { ...settings.shell, title: '其他修改', logo: '/logo.svg' },
  };
  mocks.settings.mockResolvedValueOnce(latest);
  await act(async () => hook.result.current.reviewLatest());
  expect(hook.result.current.conflicts).toEqual(['标题']);
  expect(hook.result.current.draft?.shell.title).toBe('手工修改');
  await act(async () => hook.result.current.save());
  expect(mocks.updateSettings).toHaveBeenCalledTimes(1);
  act(() => hook.result.current.resolveReview(true));
  expect(hook.result.current.draft).toMatchObject({
    pages: latest.pages,
    manifestHash: latest.manifestHash,
    shell: { title: '手工修改', logo: '/logo.svg' },
  });
  mocks.updateSettings.mockResolvedValueOnce(hook.result.current.draft);
  await act(async () => hook.result.current.save());
  expect(mocks.updateSettings).toHaveBeenLastCalledWith(
    expect.objectContaining({
      expectedManifestHash: latest.manifestHash,
      shell: expect.objectContaining({ title: '手工修改', logo: '/logo.svg' }),
    }),
  );
});
