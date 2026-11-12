import { ChatComposer } from './chat-composer';
import { ProjectTaskCard } from './project-task-card';
import { Button, Spinner } from '@origamix/ui';
import { ChevronDown, ChevronUp, RotateCcw, Sparkles } from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import { usePreferencesStore } from '@/store/preferences';
import { isRunActive, messageText } from './agent-chat-state';
import { MessageMarkdown } from './message-markdown';
import type { AgentChatSession } from './use-agent-chat';
const stageLabels = {
  queued: '已排队',
  preparing: '正在准备',
  reasoning: '正在处理请求',
  reading: '正在读取内容',
  deciding: '正在整理结果',
  validating: '正在校验',
  repairing: '正在修正',
  committing: '正在保存',
  cancelling: '正在停止',
  completed: '已完成',
  failed: '失败',
  cancelled: '已停止',
  interrupted: '已中断',
} as const;
const ProgressSteps = ({ messages }: { messages: string[] }): React.JSX.Element => {
  const [expanded, setExpanded] = useState(false);
  const latest = messages.at(-1);
  return (
    <div className='max-w-[88%] text-xs text-zinc-500 dark:text-zinc-400' aria-label='处理进度'>
      {expanded && messages.length > 1 && (
        <ol className='mb-1 space-y-1 border-l border-zinc-200 pl-3 dark:border-zinc-700'>
          {messages.slice(0, -1).map((message, index) => (
            <li key={`${index}:${message}`}>{message}</li>
          ))}
        </ol>
      )}
      <button
        type='button'
        className='flex min-h-7 max-w-full items-center gap-1.5 rounded-md px-1 text-left transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
        aria-label={expanded ? '收起处理步骤' : '展开全部处理步骤'}
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className='min-w-0' aria-live='polite'>
          {latest}
        </span>
        {expanded ? (
          <ChevronUp size={14} className='shrink-0' />
        ) : (
          <ChevronDown size={14} className='shrink-0' />
        )}
      </button>
    </div>
  );
};
export const ChatWorkspace = ({
  pageId,
  pageName,
  draft,
  onDraftChange,
  session,
  onConfigureModel,
  onClarificationHover,
  unavailableReason,
}: {
  pageId: string;
  pageName: string;
  unavailableReason?: string;
  draft: string;
  onDraftChange: (draft: string) => void;
  session: AgentChatSession;
  onConfigureModel?: () => void;
  onClarificationHover?: (elementId: string | null) => void;
}): React.JSX.Element => {
  const changePageMode = useWorkspaceStore((state) => state.changePageMode);
  const hasModelApiKey = usePreferencesStore((state) => state.hasModelApiKey);
  const {
    state,
    activity,
    pendingSubmission,
    clarificationExpired,
    send,
    selectClarification,
    cancel,
    retry,
  } = session;
  const scrollRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const active = isRunActive(state.stage);
  const projectPending = Boolean(
    session.projectTask &&
    ['awaiting_confirmation', 'applying_project', 'project_applied'].includes(
      session.projectTask.phase,
    ),
  );
  const modelConfigurationRequired = !unavailableReason && hasModelApiKey === false;
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [state.messages, state.streamedText, state.progressHistory, state.stage]);
  const currentUserMessageId = [...state.messages]
    .reverse()
    .find((message) => message.runId === state.run?.runId && message.role === 'user')?.messageId;
  const progress = state.progressHistory.length > 0 && (
    <ProgressSteps key={state.run?.runId ?? 'pending'} messages={state.progressHistory} />
  );
  const submit = async (): Promise<void> => {
    if (
      unavailableReason ||
      !draft.trim() ||
      activity !== 'idle' ||
      projectPending ||
      modelConfigurationRequired
    )
      return;
    try {
      await send(draft);
      if (mountedRef.current) onDraftChange('');
    } catch {
      // The hook keeps the actionable error and the draft remains available.
    }
  };
  return (
    <div ref={scrollRef} className='agent-chat-scrollbar min-h-0 flex-1 overflow-y-auto'>
      <div className='mx-auto flex min-h-full w-[min(780px,calc(100%-40px))] flex-col sm:w-[min(780px,calc(100%-64px))]'>
        <div className='flex-1 py-8 pb-7'>
          <div className='mb-7 flex gap-3 leading-relaxed'>
            <span className='grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'>
              <Sparkles size={14} />
            </span>
            <div>
              <strong className='text-sm'>准备好修改“{pageName}”</strong>
              <p className='mt-1 max-w-155 text-zinc-600 dark:text-zinc-300'>
                {unavailableReason ??
                  '以当前页面为主进行搭建与调整。项目角色变更会先请你确认；页面修改保留为草稿，由你决定何时保存版本。'}
              </p>
            </div>
          </div>
          {state.connection === 'recovering' && state.messages.length === 0 ? (
            <div className='flex items-center gap-2 text-zinc-500' role='status'>
              <Spinner className='size-3.5' />
              正在恢复对话…
            </div>
          ) : state.messages.length === 0 && !state.error ? (
            <p className='rounded-xl border border-dashed border-zinc-200 p-4 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400'>
              {'可以从“创建一个表单表格”开始。'}
            </p>
          ) : (
            <ol className='space-y-4' aria-label='对话记录'>
              {state.messages
                .filter((message) => message.role !== 'system')
                .map((message) => (
                  <Fragment key={message.messageId}>
                    <li
                      className={
                        message.role === 'user' ? 'flex justify-end' : 'flex justify-start'
                      }
                    >
                      <div
                        className={
                          message.role === 'user'
                            ? 'max-w-[82%] rounded-2xl bg-zinc-100 px-4 py-2.5 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                            : 'max-w-[88%] min-w-0 text-zinc-700 dark:text-zinc-200'
                        }
                      >
                        {message.role === 'assistant' ? (
                          <MessageMarkdown content={messageText(message)} />
                        ) : (
                          messageText(message)
                        )}
                      </div>
                    </li>
                    {message.messageId === currentUserMessageId && progress && (
                      <li className='pt-2'>{progress}</li>
                    )}
                  </Fragment>
                ))}
            </ol>
          )}
          {!currentUserMessageId && progress && <div className='mt-4'>{progress}</div>}
          {state.streamedText && (
            <div
              className='mt-4 max-w-[88%] min-w-0 text-zinc-700 dark:text-zinc-200'
              aria-live='polite'
            >
              <MessageMarkdown content={state.streamedText} />
            </div>
          )}
          {session.projectTask && session.decideProject && (
            <ProjectTaskCard
              key={session.projectTask.runId}
              task={session.projectTask}
              busy={session.projectTaskBusy ?? false}
              decide={session.decideProject}
            />
          )}
          {state.stage && (
            <p className='mt-3 text-xs text-zinc-500 dark:text-zinc-400' role='status'>
              {stageLabels[state.stage]}
              {active && state.connection === 'connecting' ? ' · 正在连接实时进度' : ''}
              {active && state.connection === 'connected' ? ' · 实时进度已连接' : ''}
              {active && state.connection === 'recovering' ? ' · 正在恢复实时进度' : ''}
            </p>
          )}
          {state.workingRefreshKey && (
            <div className='mt-3 flex items-center gap-2' role='status'>
              <span className='text-xs text-success'>AI 已修改草稿，尚未保存版本。</span>
              <Button size='sm' variant='ghost' onClick={() => void changePageMode(pageId, 'edit')}>
                查看修改
              </Button>
            </div>
          )}
          {state.run?.clarification?.candidates?.length ? (
            <div className='mt-4 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700'>
              <p className='mb-2 text-xs text-zinc-500 dark:text-zinc-400'>
                {clarificationExpired ? '选项已过期，请重新描述需求。' : '请选择要修改的元素：'}
              </p>
              <div className='flex flex-wrap gap-2'>
                {state.run.clarification.candidates.map((candidate, index) => (
                  <Button
                    key={candidate.elementId}
                    size='sm'
                    variant='outline'
                    disabled={clarificationExpired || activity !== 'idle'}
                    onMouseEnter={() => onClarificationHover?.(candidate.elementId)}
                    onMouseLeave={() => onClarificationHover?.(null)}
                    onFocus={() => onClarificationHover?.(candidate.elementId)}
                    onBlur={() => onClarificationHover?.(null)}
                    onClick={() =>
                      void selectClarification(candidate.elementId).catch(() => undefined)
                    }
                  >
                    {String.fromCharCode(65 + index)} · {candidate.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          {state.progressMessage && active && (
            <p
              className='mt-3 text-xs text-zinc-500 dark:text-zinc-400'
              role='status'
              aria-live='polite'
            >
              {state.progressMessage}
            </p>
          )}
          {(state.error || pendingSubmission) && (
            <div
              className='mt-4 flex items-center gap-2 rounded-xl bg-danger/10 p-3 text-danger'
              role='alert'
            >
              <span className='min-w-0 flex-1'>
                {state.error ?? '上次发送结果待确认，请重试确认结果。'}
              </span>
              <Button size='sm' variant='ghost' onClick={() => void retry().catch(() => undefined)}>
                <RotateCcw size={13} />
                重试
              </Button>
            </div>
          )}
        </div>
        <ChatComposer
          value={draft}
          onChange={onDraftChange}
          onSubmit={() => void submit()}
          onCancel={() => void cancel()}
          running={active}
          disabled={
            Boolean(unavailableReason) ||
            activity !== 'idle' ||
            projectPending ||
            modelConfigurationRequired
          }
          configurationRequired={modelConfigurationRequired}
          onConfigureModel={onConfigureModel}
          contextLabel='当前页面'
          placeholder={
            unavailableReason ??
            (modelConfigurationRequired
              ? '请先配置 DeepSeek API Key'
              : activity === 'unknown'
                ? '正在确认页面状态…'
                : active
                  ? '本轮完成后可继续修改'
                  : '描述你想创建或修改的页面')
          }
        />
      </div>
    </div>
  );
};
