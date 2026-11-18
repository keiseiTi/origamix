import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import { projectShellIssue, type ProjectSettings } from '@origamix/shared';
import { projectsService } from '@/services/projects';
import { ApiRequestError } from '@/services/request';
import { useProjectSettingsAssistant } from './use-project-settings-assistant';
import { useWorkspaceStore } from '@/store/workspace';
import { reconcileProjectSettings } from './reconcile-project-settings';

/** One retained draft shared by the form, layout renderer and AI proposal receiver. */
export const useProjectSettingsSession = (projectId: string) => {
  const [form, renderForm] = useState<{
    draft: ProjectSettings;
    baseline: ProjectSettings;
    version: number;
    stale: boolean;
    latest?: ProjectSettings;
  }>();
  const current = useRef(form);
  const publish = useCallback((next: typeof form) => {
    current.current = next;
    renderForm(next);
  }, []);
  const activeForm = form?.draft.projectId === projectId ? form : undefined;
  const { draft, baseline, stale, latest } = activeForm ?? {};
  const generation = useRef(0);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState(false);
  const setDraft = (update: SetStateAction<ProjectSettings | undefined>) => {
    const form = current.current;
    if (!form || form.draft.projectId !== projectId || saving.current) return;
    const next = typeof update === 'function' ? update(form.draft) : update;
    if (!next || next.projectId !== projectId) return;
    publish({ ...form, draft: next, version: form.version + 1 });
    setSaved(false);
  };
  useEffect(() => {
    generation.current += 1;
    current.current = undefined;
    saving.current = false;
    const controller = new AbortController();
    void projectsService
      .settings(projectId)
      .then((next) => {
        if (!controller.signal.aborted) {
          if (next.projectId !== projectId) throw new Error('读取的设置与当前项目不一致');
          publish({ draft: next, baseline: next, version: 1, stale: false });
          setError(undefined);
          setSaved(false);
          setBusy(false);
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : '读取配置失败');
      });
    return () => {
      generation.current += 1;
      controller.abort();
    };
  }, [projectId, attempt, publish]);
  const readDraft = () => {
    const form = current.current;
    return form?.draft.projectId === projectId && !form.stale && !saving.current ? form : undefined;
  };
  const assistant = useProjectSettingsAssistant({
    projectId,
    attempt,
    readDraft,
    applyProposal: (version, proposal) => {
      const form = readDraft();
      if (!form || form.version !== version)
        throw new Error('生成期间表单已修改，AI 结果未应用。你的修改已保留，请重新发送');
      const issue = projectShellIssue(proposal.shell, form.draft.pages);
      if (issue) throw new Error(issue);
      setDraft({ ...form.draft, ...proposal });
    },
  });
  const save = async () => {
    const form = readDraft();
    if (!form || assistant.isRunning()) return;
    const snapshot = form.draft;
    const issue = projectShellIssue(snapshot.shell, snapshot.pages);
    if (issue) {
      setError(issue);
      return;
    }
    const saveGeneration = generation.current;
    saving.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const next = await projectsService.updateSettings({
        projectId,
        expectedManifestHash: snapshot.manifestHash,
        shell: snapshot.shell,
        layout: snapshot.layout,
        routing: snapshot.routing,
      });
      if (generation.current !== saveGeneration || current.current !== form) return;
      if (next.projectId !== projectId) throw new Error('保存结果与当前项目不一致');
      publish({ draft: next, baseline: next, version: form.version + 1, stale: false });
      setSaved(true);
      useWorkspaceStore.getState().setProjects((projects) =>
        projects.map((project) =>
          project.id === projectId
            ? {
                ...project,
                name: next.name,
                runtime: 'origamix',
                layoutEnabled: next.layout.enabled,
              }
            : project,
        ),
      );
    } catch (reason) {
      if (generation.current === saveGeneration && current.current === form) {
        if (reason instanceof ApiRequestError && reason.status === 409)
          publish({ ...form, stale: true });
        setError(reason instanceof Error ? reason.message : '保存失败，输入已保留');
      }
    } finally {
      if (generation.current === saveGeneration) {
        saving.current = false;
        setBusy(false);
      }
    }
  };
  const review =
    latest && draft?.projectId === projectId && baseline
      ? reconcileProjectSettings(baseline, draft, latest)
      : undefined;
  const applyLatest = (next: ProjectSettings, merged: ProjectSettings) => {
    const form = current.current;
    if (!form || form.draft.projectId !== projectId) return;
    publish({ draft: merged, baseline: next, version: form.version + 1, stale: false });
    setSaved(false);
    setError(projectShellIssue(merged.shell, merged.pages) ?? undefined);
  };
  const reviewLatest = async () => {
    const form = current.current;
    if (!form || form.draft.projectId !== projectId || saving.current || assistant.isRunning())
      return;
    const readGeneration = generation.current;
    saving.current = true;
    setBusy(true);
    try {
      const next = await projectsService.settings(projectId);
      if (generation.current !== readGeneration || current.current !== form) return;
      if (next.projectId !== projectId) throw new Error('读取的设置与当前项目不一致');
      const result = reconcileProjectSettings(form.baseline, form.draft, next);
      if (result.conflicts.length) publish({ ...form, latest: next });
      else applyLatest(next, result.draft);
    } catch (reason) {
      if (generation.current === readGeneration)
        setError(reason instanceof Error ? reason.message : '无法读取最新配置，草稿已保留');
    } finally {
      if (generation.current === readGeneration) {
        saving.current = false;
        setBusy(false);
      }
    }
  };
  const resolveReview = (keepDraft: boolean) => {
    const form = current.current;
    if (!form?.latest || form.draft.projectId !== projectId || saving.current) return;
    const result = reconcileProjectSettings(form.baseline, form.draft, form.latest, keepDraft);
    applyLatest(form.latest, result.draft);
  };
  return {
    draft,
    setDraft,
    error,
    busy,
    saved,
    stale: Boolean(stale),
    reviewLatest,
    conflicts: review?.conflicts,
    latest,
    resolveReview,
    dismissReview: () => {
      const form = current.current;
      if (form?.latest && form.draft.projectId === projectId && !saving.current)
        publish({ ...form, latest: undefined });
    },
    save,
    reload: () => setAttempt((value) => value + 1),
    ...assistant,
  };
};
