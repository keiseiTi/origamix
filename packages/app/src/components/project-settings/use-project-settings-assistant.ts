import { useEffect, useRef, useState } from 'react';
import {
  projectShellIssue,
  type ProjectSettings,
  type ProjectSettingsDraft,
} from '@origamix/shared';
import { subscribeBackendStatus } from '@/services/request';
import { assistProjectSettings } from '@/services/project-settings-agent';

interface SettingsChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export const useProjectSettingsAssistant = ({
  projectId,
  attempt,
  readDraft,
  applyProposal,
}: {
  projectId: string;
  attempt: number;
  readDraft: () => { draft: ProjectSettings; version: number } | undefined;
  applyProposal: (version: number, proposal: ProjectSettingsDraft) => void;
}) => {
  const [messages, setMessages] = useState<SettingsChatMessage[]>([]);
  const messagesRef = useRef<SettingsChatMessage[]>([]);
  const [stream, setStream] = useState('');
  const [progress, setProgress] = useState('');
  const [running, setRunning] = useState(false);
  const execution = useRef<AbortController | null>(null);
  const [chatError, setChatError] = useState<string>();
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    messagesRef.current = [];
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setMessages([]);
      setStream('');
      setProgress('');
      setRunning(false);
      setChatError(undefined);
      setChanged(false);
    });
    const unsubscribe = subscribeBackendStatus(() => {
      if (execution.current) {
        execution.current.abort();
        execution.current = null;
        setRunning(false);
        setStream('');
        setProgress('');
        setChatError('后端连接已变化，配置草稿已保留，请重新发送');
      }
    });
    return () => {
      active = false;
      execution.current?.abort();
      execution.current = null;
      unsubscribe();
    };
  }, [projectId, attempt]);
  const send = async (prompt: string): Promise<boolean> => {
    const input = readDraft();
    if (!input || execution.current || !prompt.trim()) return false;
    const { draft: snapshot, version: baseVersion } = input;
    const issue = projectShellIssue(snapshot.shell, snapshot.pages);
    if (issue) {
      setChatError(`请先修正表单：${issue}`);
      throw new Error(issue);
    }
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
    const active = () => execution.current === controller && !controller.signal.aborted;
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
              applyProposal(baseVersion, event.draft);
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
  const cancel = () => {
    execution.current?.abort();
    execution.current = null;
    setRunning(false);
    setStream('');
    setProgress('');
    setChatError('已停止，配置草稿保持不变');
  };
  return {
    isRunning: () => execution.current !== null,
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
