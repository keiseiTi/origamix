import { useEffect, useRef, useState, type SetStateAction } from 'react';
import {
  projectShellIssue,
  type ProjectSettings,
  type ProjectSettingsDraft,
} from '@origamix/shared';
import { projectsService } from '@/services/projects';
import { subscribeBackendStatus } from '@/services/request';
import { assistProjectSettings } from '@/services/project-settings-agent';
import { useWorkspaceStore } from '@/store/workspace';

export interface SettingsChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

/** One retained draft shared by the form, layout renderer and AI proposal receiver. */
export const useProjectSettingsSession = (projectId: string) => {
  const [draft, renderDraft] = useState<ProjectSettings>();
  const current = useRef<ProjectSettings | undefined>(undefined);
  const version = useRef(0);
  const mounted = useRef(false);
  const generation = useRef(0);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState(false);
  const [messages, setMessages] = useState<SettingsChatMessage[]>([]);
  const messagesRef = useRef<SettingsChatMessage[]>([]);
  const [stream, setStream] = useState('');
  const [progress, setProgress] = useState('');
  const [running, setRunning] = useState(false);
  const execution = useRef<AbortController | null>(null);
  const [chatError, setChatError] = useState<string>();
  const [changed, setChanged] = useState(false);
  const setDraft = (update: SetStateAction<ProjectSettings | undefined>) => {
    if (saving.current) return;
    const next = typeof update === 'function' ? update(current.current) : update;
    current.current = next;
    version.current += 1;
    renderDraft(next);
    setSaved(false);
  };
  useEffect(() => {
    mounted.current = true;
    generation.current += 1;
    current.current = undefined;
    saving.current = false;
    messagesRef.current = [];
    const controller = new AbortController();
    void projectsService
      .settings(projectId)
      .then((next) => {
        if (!controller.signal.aborted) {
          current.current = next;
          version.current += 1;
          renderDraft(next);
          setError(undefined);
          setBusy(false);
          setSaved(false);
          setMessages([]);
          setStream('');
          setRunning(false);
          setChatError(undefined);
          setChanged(false);
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : '读取配置失败');
      });
    const unsubscribe = subscribeBackendStatus(() => {
      if (execution.current) {
        execution.current.abort();
        execution.current = null;
        setRunning(false);
        setStream('');
        setChatError('后端连接已变化，配置草稿已保留，请重新发送');
      }
    });
    return () => {
      mounted.current = false;
      generation.current += 1;
      controller.abort();
      execution.current?.abort();
      execution.current = null;
      unsubscribe();
    };
  }, [projectId, attempt]);
  const save = async () => {
    const snapshot = current.current;
    if (!snapshot || saving.current || execution.current) return;
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
      if (!mounted.current || generation.current !== saveGeneration) return;
      current.current = next;
      version.current += 1;
      renderDraft(next);
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
      if (mounted.current && generation.current === saveGeneration)
        setError(reason instanceof Error ? reason.message : '保存失败，输入已保留');
    } finally {
      if (generation.current === saveGeneration) {
        saving.current = false;
        if (mounted.current) setBusy(false);
      }
    }
  };
  const send = async (prompt: string): Promise<boolean> => {
    const snapshot = current.current;
    if (!snapshot || saving.current || execution.current || !prompt.trim()) return false;
    const issue = projectShellIssue(snapshot.shell, snapshot.pages);
    if (issue) {
      setChatError(`请先修正表单：${issue}`);
      throw new Error(issue);
    }
    const baseVersion = version.current;
    const controller = new AbortController();
    execution.current = controller;
    setRunning(true);
    setChatError(undefined);
    setChanged(false);
    setStream('');
    setProgress('正在准备配置上下文');
    const history = messagesRef.current
      .slice(-12)
      .map((message) => ({ ...message, text: message.text.slice(0, 8000) }));
    messagesRef.current = [...messagesRef.current, { role: 'user', text: prompt }];
    setMessages(messagesRef.current);
    let completed = false;
    const active = () =>
      mounted.current && execution.current === controller && !controller.signal.aborted;
    try {
      await assistProjectSettings(
        {
          projectId,
          expectedManifestHash: snapshot.manifestHash,
          draftVersion: baseVersion,
          draft: { shell: snapshot.shell, layout: snapshot.layout, routing: snapshot.routing },
          prompt: prompt.trim(),
          history,
        },
        controller.signal,
        (event) => {
          if (!active()) return;
          if (completed) throw new Error('助手重复提交结果');
          if (event.type === 'text') setStream((text) => text + event.delta);
          if (event.type === 'progress') setProgress(event.message);
          if (event.type === 'failed') {
            completed = true;
            throw new Error(event.message);
          }
          if (event.type === 'completed') {
            if (event.projectId !== projectId || event.draftVersion !== baseVersion)
              throw new Error('助手结果与当前配置会话不一致');
            completed = true;
            if (event.draft) {
              if (version.current !== baseVersion)
                throw new Error('生成期间表单已修改，AI 结果未应用。你的修改已保留，请重新发送');
              applyProposal(event.draft);
              setChanged(true);
            }
            messagesRef.current = [...messagesRef.current, { role: 'assistant', text: event.text }];
            setMessages(messagesRef.current);
            setStream('');
          }
        },
      );
      if (active() && !completed) throw new Error('助手连接中断，配置草稿未修改，请重新发送');
      return active() && completed;
    } catch (reason) {
      if (active())
        setChatError(reason instanceof Error ? reason.message : '请求失败，配置草稿已保留');
      return false;
    } finally {
      if (active()) {
        execution.current = null;
        setRunning(false);
        setStream('');
        setProgress('');
      }
    }
  };
  const applyProposal = (proposal: ProjectSettingsDraft) => {
    const snapshot = current.current;
    if (!snapshot) return;
    const issue = projectShellIssue(proposal.shell, snapshot.pages);
    if (issue) throw new Error(issue);
    setDraft({ ...snapshot, ...proposal });
  };
  const cancel = () => {
    execution.current?.abort();
    execution.current = null;
    setRunning(false);
    setStream('');
    setProgress('');
    setChatError('已停止，配置草稿保持不变');
  };
  return {
    draft: draft?.projectId === projectId ? draft : undefined,
    setDraft,
    error,
    busy,
    saved,
    save,
    reload: () => setAttempt((value) => value + 1),
    messages,
    stream,
    progress,
    running,
    chatError,
    changed,
    send,
    cancel,
  };
};
