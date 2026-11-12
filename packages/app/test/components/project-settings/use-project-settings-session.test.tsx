// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ProjectSettings, ProjectSettingsAgentEvent } from '@origamix/shared';
const mocks = vi.hoisted(() => ({ settings: vi.fn(), updateSettings: vi.fn(), assist: vi.fn() }));
vi.mock('../../../src/services/projects', () => ({ projectsService: mocks }));
vi.mock('../../../src/services/project-settings-agent', () => ({
  assistProjectSettings: mocks.assist,
}));
import { useProjectSettingsSession } from '../../../src/components/project-settings/use-project-settings-session';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

// Only the browser can prove that an in-flight proposal cannot replace newer form input or survive unmount.
it('shares AI/form drafts, rejects late AI results, preserves failed saves and cancels abandoned sessions', async () => {
  const settings: ProjectSettings = {
    projectId: 'project_test',
    name: 'Test',
    pages: [],
    manifestHash: 'a'.repeat(64),
    layout: { enabled: true, initialVariant: 'mix' },
    routing: { mode: 'browser', basePath: '/' },
    shell: { title: '', logo: '', standalonePageIds: [] },
  };
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
    try {
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
    } catch {
      /* The stream adapter propagates receiver errors through its promise. */
    }
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
  mocks.updateSettings.mockRejectedValue(new Error('保存冲突'));
  await act(async () => {
    await hook.result.current.save();
  });
  expect(hook.result.current.draft?.shell.title).toBe('新 AI');
  expect(hook.result.current.error).toBe('保存冲突');
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
