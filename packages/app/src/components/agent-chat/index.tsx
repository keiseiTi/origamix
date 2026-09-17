import { Button, Spinner, TextArea } from '@heroui/react';
import { CircleStop, LayoutPanelLeft, RotateCcw, Send, Sparkles, Wrench } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { isRunActive, messageText } from './agent-chat-state';
import type { AgentChatSession } from './use-agent-chat';

const stageLabels = {
  queued: '已排队',
  classifying: '正在理解需求',
  generating: '正在生成',
  tool_calling: '正在搭建页面',
  validating: '正在校验',
  committing: '正在保存',
  awaiting_confirmation: '等待确认',
  cancelling: '正在停止',
  completed: '已完成',
  failed: '失败',
  cancelled: '已停止',
  interrupted: '已中断',
} as const;

export const ChatWorkspace = ({
  pageName,
  draft,
  onDraftChange,
  session,
}: {
  pageName: string;
  draft: string;
  onDraftChange: (draft: string) => void;
  session: AgentChatSession;
}): React.JSX.Element => {
  const { state, activity, pendingSubmission, send, cancel, retry } = session;
  const scrollRef = useRef<HTMLDivElement>(null);
  const active = isRunActive(state.stage);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [state.messages, state.streamedText]);

  const submit = async (): Promise<void> => {
    if (!draft.trim() || activity !== 'idle') return;
    try {
      await send(draft);
      onDraftChange('');
    } catch {
      // The hook keeps the actionable error and the draft remains available.
    }
  };

  return (
    <div className='flex min-h-0 flex-1 flex-col items-center'>
      <div
        ref={scrollRef}
        className='w-[min(780px,calc(100%-40px))] flex-1 overflow-y-auto py-8 pb-7 sm:w-[min(780px,calc(100%-64px))]'
      >
        <div className='mb-7 flex gap-3 leading-relaxed'>
          <span className='grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'>
            <Sparkles size={14} />
          </span>
          <div>
            <strong className='text-sm'>准备好修改“{pageName}”</strong>
            <p className='mt-1 max-w-155 text-zinc-600 dark:text-zinc-300'>
              只处理当前页面的搭建与使用问题。页面变更会先通过校验，再写入一个可撤销版本。
            </p>
          </div>
        </div>
        {state.connection === 'recovering' && state.messages.length === 0 ? (
          <div className='flex items-center gap-2 text-zinc-500' role='status'>
            <Spinner size='sm' />
            正在恢复对话…
          </div>
        ) : state.messages.length === 0 && !state.error ? (
          <p className='rounded-xl border border-dashed border-zinc-200 p-4 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400'>
            可以从“创建一个客户信息表单”开始。
          </p>
        ) : (
          <ol className='space-y-4' aria-label='对话记录'>
            {state.messages.map((message) => (
              <li
                key={message.messageId}
                className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={
                    message.role === 'user'
                      ? 'max-w-[82%] rounded-2xl bg-zinc-100 px-4 py-2.5 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                      : 'max-w-[88%] whitespace-pre-wrap text-zinc-700 dark:text-zinc-200'
                  }
                >
                  {messageText(message)}
                </div>
              </li>
            ))}
          </ol>
        )}
        {state.streamedText && (
          <div
            className='mt-4 max-w-[88%] whitespace-pre-wrap text-zinc-700 dark:text-zinc-200'
            aria-live='polite'
          >
            {state.streamedText}
          </div>
        )}
        {state.tools.length > 0 && (
          <ul
            className='mt-4 space-y-1 text-xs text-zinc-500 dark:text-zinc-400'
            aria-label='工具执行摘要'
          >
            {state.tools.map((tool) => (
              <li key={tool.id} className='flex items-center gap-1.5'>
                <Wrench size={12} />
                {tool.name} ·{' '}
                {tool.status === 'running'
                  ? '执行中'
                  : tool.status === 'completed'
                    ? '已完成'
                    : '失败'}
              </li>
            ))}
          </ul>
        )}
        {state.stage && (
          <p className='mt-3 text-xs text-zinc-500 dark:text-zinc-400' role='status'>
            {stageLabels[state.stage]}
            {state.connection === 'recovering' ? ' · 正在重新连接' : ''}
          </p>
        )}
        {state.committedRevisionId && (
          <p className='mt-2 text-xs text-success' role='status'>
            页面已提交，编辑器正在加载该版本。
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
            <Button size='sm' variant='ghost' onPress={() => void retry().catch(() => undefined)}>
              <RotateCcw size={13} />
              重试
            </Button>
          </div>
        )}
      </div>
      <div className='w-[min(780px,calc(100%-40px))] rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-[0_8px_24px_rgb(0_0_0/0.1)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_8px_24px_rgb(0_0_0/0.35)] sm:w-[min(780px,calc(100%-64px))]'>
        <TextArea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submit();
            }
          }}
          disabled={activity !== 'idle'}
          variant='secondary'
          className='block min-h-16 w-full resize-none border-0 bg-transparent px-2 py-1.5 shadow-none outline-none'
          aria-label='发送消息'
          placeholder={
            activity === 'unknown'
              ? '正在确认页面状态…'
              : active
                ? '本轮完成后可继续修改'
                : '描述你想创建或修改的页面'
          }
        />
        <footer className='flex items-center justify-between'>
          <span className='flex items-center gap-1.5 px-2 text-xs text-zinc-500 dark:text-zinc-400'>
            <LayoutPanelLeft size={14} />
            当前页面
          </span>
          {active ? (
            <Button
              size='sm'
              variant='secondary'
              onPress={() => void cancel()}
              aria-label='停止生成'
            >
              <CircleStop size={14} />
              停止
            </Button>
          ) : (
            <Button
              isIconOnly
              size='sm'
              className='h-7 min-h-7 w-7 min-w-7'
              aria-label='发送'
              isDisabled={!draft.trim() || activity !== 'idle'}
              onPress={() => void submit()}
            >
              <Send size={15} />
            </Button>
          )}
        </footer>
      </div>
      <p className='mt-2 mb-2.5 text-[10px] text-zinc-400 dark:text-zinc-500'>
        AI 可能会出错，请检查生成结果。
      </p>
    </div>
  );
};
