import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import {
  CircleStop,
  KeyRound,
  LayoutPanelLeft,
  RotateCcw,
  Send,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { usePreferencesStore } from '@/store/preferences';
import { isRunActive, messageText } from './agent-chat-state';
import type { AgentChatSession } from './use-agent-chat';

const stageLabels = {
  queued: '已排队',
  preparing: '正在准备',
  reasoning: '正在处理请求',
  reading: '正在读取页面',
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

const toolLabels: Record<string, string> = {
  get_page_context: '读取页面上下文',
  get_schema_outline: '读取页面结构',
  get_schema_fragment: '读取元素详情',
  search_materials: '查找可用物料',
  get_material_manifest: '读取物料定义',
  search_product_docs: '查询产品规则',
  validate_page_schema: '校验页面结构',
  get_page_diagnostics: '检查页面诊断',
  complete_page_run: '生成并执行页面操作链',
};

export const ChatWorkspace = ({
  pageName,
  draft,
  onDraftChange,
  session,
  onViewChanges,
  onConfigureModel,
  onClarificationHover,
}: {
  pageName: string;
  draft: string;
  onDraftChange: (draft: string) => void;
  session: AgentChatSession;
  onViewChanges: () => Promise<void>;
  onConfigureModel?: () => void;
  onClarificationHover?: (elementId: string | null) => void;
}): React.JSX.Element => {
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
  const active = isRunActive(state.stage);
  const modelConfigurationRequired = hasModelApiKey === false;
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [state.messages, state.streamedText]);

  const submit = async (): Promise<void> => {
    if (!draft.trim() || activity !== 'idle' || modelConfigurationRequired) return;
    try {
      await send(draft);
      onDraftChange('');
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
                只处理当前页面的搭建与使用问题。页面变更会先通过校验并保留为草稿，由你决定何时保存版本。
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
                  {toolLabels[tool.name] ?? tool.name} ·{' '}
                  {tool.status === 'running'
                    ? '执行中'
                    : tool.status === 'completed'
                      ? '已完成'
                      : '失败'}
                </li>
              ))}
            </ul>
          )}
          {state.progressHistory.length > 0 && (
            <ol
              className='mt-4 space-y-1 text-xs text-zinc-500 dark:text-zinc-400'
              aria-label='处理进度'
              aria-live='polite'
            >
              {state.progressHistory.map((message, index) => (
                <li key={`${index}:${message}`}>{message}</li>
              ))}
            </ol>
          )}
          {state.stage && (
            <p className='mt-3 text-xs text-zinc-500 dark:text-zinc-400' role='status'>
              {stageLabels[state.stage]}
              {state.connection === 'recovering' ? ' · 正在重新连接' : ''}
            </p>
          )}
          {state.workingRefreshKey && (
            <div className='mt-3 flex items-center gap-2' role='status'>
              <span className='text-xs text-success'>AI 已修改草稿，尚未保存版本。</span>
              <Button size='sm' variant='ghost' onClick={() => void onViewChanges()}>
                查看修改
              </Button>
            </div>
          )}
          {state.run?.clarification?.candidates?.length ? (
            <div className='mt-4 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700'>
              <p className='mb-2 text-xs text-zinc-500 dark:text-zinc-400'>
                {clarificationExpired ? '选项已过期，请重新描述需求。' : '请选择页面中的目标：'}
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
        <div className='sticky bottom-0 z-10 bg-linear-to-t from-white from-85% to-white/0 pt-3 dark:from-zinc-950 dark:to-zinc-950/0'>
          {modelConfigurationRequired && (
            <div
              className='mb-2 flex items-center gap-3 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2.5 text-amber-950 shadow-md dark:border-amber-800/70 dark:bg-amber-950 dark:text-amber-100'
              role='status'
            >
              <KeyRound size={16} className='shrink-0 text-amber-600 dark:text-amber-400' />
              <div className='min-w-0 flex-1'>
                <strong className='block text-xs'>尚未配置 DeepSeek API Key</strong>
                <span className='text-[11px] text-amber-700 dark:text-amber-300'>
                  配置后即可开始 AI 对话。
                </span>
              </div>
              <Button size='sm' variant='ghost' onClick={onConfigureModel}>
                前往设置
              </Button>
            </div>
          )}
          <div className='rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-[0_8px_24px_rgb(0_0_0/0.1)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_8px_24px_rgb(0_0_0/0.35)]'>
            <Textarea
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void submit();
                }
              }}
              disabled={activity !== 'idle' || modelConfigurationRequired}
              className='block min-h-16 w-full resize-none border-0 bg-transparent px-2 py-1.5 shadow-none outline-none'
              aria-label='发送消息'
              placeholder={
                modelConfigurationRequired
                  ? '请先配置 DeepSeek API Key'
                  : activity === 'unknown'
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
                  onClick={() => void cancel()}
                  aria-label='停止生成'
                >
                  <CircleStop size={14} />
                  停止
                </Button>
              ) : (
                <Button
                  size='icon-sm'
                  className='h-7 min-h-7 w-7 min-w-7'
                  aria-label='发送'
                  disabled={!draft.trim() || activity !== 'idle' || modelConfigurationRequired}
                  onClick={() => void submit()}
                >
                  <Send size={15} />
                </Button>
              )}
            </footer>
          </div>
          <p className='mt-2 mb-2.5 text-center text-[10px] text-zinc-400 dark:text-zinc-500'>
            AI 可能会出错，请检查生成结果。
          </p>
        </div>
      </div>
    </div>
  );
};
