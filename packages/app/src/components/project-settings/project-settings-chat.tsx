import { useEffect, useRef, useState } from 'react';
import { Button } from '@origamix/ui';
import { Sparkles } from 'lucide-react';
import { ChatComposer } from '@/components/agent-chat/chat-composer';
import { MessageMarkdown } from '@/components/agent-chat/message-markdown';
import { usePreferencesStore } from '@/store/preferences';
import type { useProjectSettingsSession } from './use-project-settings-session';

export const ProjectSettingsChat = ({
  session,
  onConfigureModel,
  onViewChanges,
}: {
  session: ReturnType<typeof useProjectSettingsSession>;
  onConfigureModel: () => void;
  onViewChanges: () => void;
}) => {
  const [input, setInput] = useState('');
  const scroll = useRef<HTMLDivElement>(null);
  const configurationRequired = usePreferencesStore((state) => state.hasModelApiKey) === false;
  useEffect(() => {
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight });
  }, [session.messages, session.stream, session.progress]);
  const submit = async () => {
    const text = input;
    try {
      if (await session.send(text)) setInput('');
    } catch {
      /* Draft is retained on validation failure. */
    }
  };
  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <div ref={scroll} className='min-h-0 flex-1 space-y-4 overflow-y-auto py-3 text-sm'>
        <div className='flex gap-2 text-muted-foreground'>
          <Sparkles size={16} className='mt-0.5 shrink-0' />
          <p>描述布局、品牌或菜单需求。AI 和表单共用当前草稿，确认效果后点击“保存布局配置”。</p>
        </div>
        {!session.messages.length && (
          <p className='rounded-lg border border-dashed border-border p-3 text-muted-foreground'>
            例如：使用混合布局，标题改为“管理中心”，按现有页面整理父子菜单。
          </p>
        )}
        <ol aria-label='布局助手对话记录' className='space-y-4'>
          {session.messages.map((message, index) => (
            <li
              key={index}
              className={message.role === 'user' ? 'ml-5 rounded-xl bg-muted p-3' : 'mr-2'}
            >
              {message.role === 'assistant' ? (
                <MessageMarkdown content={message.text} />
              ) : (
                <p className='whitespace-pre-wrap'>{message.text}</p>
              )}
            </li>
          ))}
        </ol>
        {session.stream && (
          <div aria-live='polite'>
            <MessageMarkdown content={session.stream} />
          </div>
        )}
        {session.running && (
          <p role='status' className='text-xs text-muted-foreground'>
            {session.progress || '正在生成配置建议…'}
          </p>
        )}
        {session.changed && (
          <div role='status' className='flex items-center gap-2 text-xs text-success'>
            AI 已修改草稿，尚未保存。
            <Button size='sm' variant='ghost' onClick={onViewChanges}>
              查看修改
            </Button>
          </div>
        )}
        {session.chatError && (
          <p role='alert' className='rounded-lg bg-destructive/10 p-3 text-sm text-destructive'>
            {session.chatError}。可修改描述后重新发送。
          </p>
        )}
      </div>
      <ChatComposer
        value={input}
        onChange={setInput}
        onSubmit={() => void submit()}
        onCancel={session.cancel}
        running={session.running}
        disabled={session.running || session.busy || configurationRequired || !session.draft}
        configurationRequired={configurationRequired}
        onConfigureModel={onConfigureModel}
        placeholder={configurationRequired ? '请先配置 DeepSeek API Key' : '描述你想调整的布局配置'}
        contextLabel='当前项目布局'
      />
    </div>
  );
};
