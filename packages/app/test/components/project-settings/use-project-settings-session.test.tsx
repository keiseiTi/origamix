// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ProjectSettings, ProjectSettingsAgentEvent } from '@origamix/shared';
const mocks = vi.hoisted(() => ({ settings: vi.fn(), updateSettings: vi.fn(), assist: vi.fn() }));
vi.mock('../../../src/services/projects', () => ({ projectsService: mocks }));
vi.mock('../../../src/services/project-settings-agent', () => ({
  assistProjectSettings: mocks.assist,
}));
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

// Only the browser can prove that an in-flight proposal cannot replace newer form input or survive unmount.
it('rejects stale AI proposals and cancels abandoned settings sessions', async () => {
  mocks.settings.mockResolvedValue(settings);
  let receive!: (event: ProjectSettingsAgentEvent) => void;
  let finish!: () => void;
  let signal!: AbortSignal;
  mocks.assist.mockImplementation((_input, abortSignal, listener) => {
    signal = abortSignal;
    return new Promise<void>((resolve, reject) => {
      finish = resolve;
      receive = (event) => {
        try {
          listener(event);
        } catch (error) {
          reject(error);
        }
      };
    });
  });
  const hook = renderHook(({ projectId }) => useProjectSettingsSession(projectId), {
    initialProps: { projectId: 'project_test' },
  });
  await act(async () => undefined);
  let pending!: Promise<boolean>;
  act(() => {
    pending = hook.result.current.send('修改标题');
  });
  act(() => {
    hook.result.current.setDraft({ ...settings, shell: { ...settings.shell, title: '手工修改' } });
  });
  await act(async () => {
    receive({
      type: 'completed',
      projectId: 'project_test',
      draftVersion: 1,
      text: 'AI 修改',
      draft: {
        shell: { ...settings.shell, title: '旧 AI' },
        layout: settings.layout,
        routing: settings.routing,
      },
    });
    finish();
    await pending;
  });
  expect(hook.result.current.draft?.shell.title).toBe('手工修改');
  expect(hook.result.current.chatError).toContain('表单已修改');
  // Exercise an accepted proposal against the actual latest form version.
  act(() => {
    pending = hook.result.current.send('继续调整');
  });
  const input = mocks.assist.mock.calls.at(-1)![0];
  expect(input.draft.shell.title).toBe('手工修改');
  await act(async () => {
    receive({
      type: 'completed',
      projectId: 'project_test',
      draftVersion: input.draftVersion,
      text: '新草稿',
      draft: {
        shell: { ...settings.shell, title: '新 AI' },
        layout: settings.layout,
        routing: settings.routing,
      },
    });
    finish();
    await pending;
  });
  expect(hook.result.current.draft?.shell.title).toBe('新 AI');
  expect(mocks.updateSettings).not.toHaveBeenCalled();
  act(() => {
    pending = hook.result.current.send('再次调整');
  });
  const oldReceive = receive;
  const oldFinish = finish;
  const oldPending = pending;
  const oldSignal = signal;
  const nextSettings = {
    ...settings,
    projectId: 'project_next',
    shell: { ...settings.shell, title: '另一个项目' },
  };
  mocks.settings.mockResolvedValue(nextSettings);
  hook.rerender({ projectId: 'project_next' });
  await act(async () => undefined);
  expect(oldSignal.aborted).toBe(true);
  await act(async () => {
    oldReceive({
      type: 'completed',
      projectId: 'project_test',
      draftVersion: 3,
      text: '迟到结果',
      draft: { shell: settings.shell, layout: settings.layout, routing: settings.routing },
    });
    oldFinish();
    await oldPending;
  });
  expect(hook.result.current.draft?.shell.title).toBe('另一个项目');
  act(() => {
    pending = hook.result.current.send('调整新项目');
  });
  hook.unmount();
  expect(signal.aborted).toBe(true);
  finish();
  await pending;
});

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
