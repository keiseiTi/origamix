import { Button, Textarea } from '@origamix/ui';
import { CircleStop, KeyRound, LayoutPanelLeft, Send } from 'lucide-react';

export const ChatComposer = ({
  value,
  onChange,
  onSubmit,
  onCancel,
  running,
  disabled,
  configurationRequired,
  onConfigureModel,
  placeholder,
  contextLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  running: boolean;
  disabled: boolean;
  configurationRequired: boolean;
  onConfigureModel?: () => void;
  placeholder: string;
  contextLabel: string;
}) => (
  <div className='sticky bottom-0 z-10 bg-linear-to-t from-white from-85% to-white/0 pt-3 dark:from-zinc-950 dark:to-zinc-950/0'>
    {configurationRequired && (
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
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            if (!disabled && value.trim()) onSubmit();
          }
        }}
        disabled={disabled}
        className='block min-h-16 w-full resize-none border-0 bg-transparent px-2 py-1.5 shadow-none outline-none'
        aria-label='发送消息'
        placeholder={placeholder}
      />
      <footer className='mt-2 flex items-center justify-between'>
        <span className='flex items-center gap-1.5 px-2 text-xs text-zinc-500 dark:text-zinc-400'>
          <LayoutPanelLeft size={14} />
          {contextLabel}
        </span>
        {running ? (
          <Button size='sm' variant='secondary' onClick={onCancel} aria-label='停止生成'>
            <CircleStop size={14} />
            停止
          </Button>
        ) : (
          <Button
            size='icon-sm'
            className='h-6 min-h-6 w-6 min-w-6'
            aria-label='发送'
            disabled={disabled || !value.trim()}
            onClick={onSubmit}
          >
            <Send size={14} />
          </Button>
        )}
      </footer>
    </div>
    <p className='mt-2 mb-2.5 text-center text-[10px] text-zinc-400 dark:text-zinc-500'>
      AI 可能会出错，请检查生成结果。
    </p>
  </div>
);
