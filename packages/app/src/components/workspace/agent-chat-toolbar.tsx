import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@origamix/ui';
import { History, MessageSquarePlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ListConversationsResponse } from '@origamix/shared';
import { ErrorToast } from '@/components/error-toast';
import { listConversations } from '@/services/agent';
import type { AgentChatSession } from '@/components/agent-chat/use-agent-chat';
import { PageToolbarShell, type PageToolbarProps } from './page-toolbar';

export type WorkspaceToolbarProps = Omit<
  PageToolbarProps,
  'navigation' | 'children' | 'onOpenEditorTool'
>;

type ConversationActionsProps = Pick<WorkspaceToolbarProps, 'projectId' | 'pageId'> & {
  agent: Pick<AgentChatSession, 'conversationId' | 'activity' | 'selectConversation'>;
};

const ConversationHistory = ({ projectId, pageId, agent }: ConversationActionsProps) => {
  const [history, setHistory] = useState<ListConversationsResponse | null>(null);
  const [offset, setOffset] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let disposed = false;
    void listConversations(projectId, pageId, offset)
      .then((result) => {
        if (disposed) return;
        setHistory((current) => {
          const previous = offset ? (current?.conversations ?? []) : [];
          const seen = new Set(previous.map((item) => item.conversationId));
          return {
            ...result,
            conversations: [
              ...previous,
              ...result.conversations.filter((item) => !seen.has(item.conversationId)),
            ],
          };
        });
      })
      .catch((error: unknown) => {
        if (!disposed) setFailure(error instanceof Error ? error.message : '无法加载对话历史');
      });
    return () => {
      disposed = true;
    };
  }, [projectId, pageId, offset, attempt]);

  const nextOffset = history?.nextOffset;
  const loading = !failure && (!history || nextOffset === offset);
  return (
    <>
      <ErrorToast message={failure} />
      <div className='max-h-[50dvh] space-y-1 overflow-y-auto' aria-busy={loading}>
        {history?.conversations.map((item) => (
          <DialogClose
            key={item.conversationId}
            render={
              <Button
                className='flex h-auto w-full justify-between gap-3 py-2 text-left'
                variant={item.conversationId === agent.conversationId ? 'secondary' : 'ghost'}
                aria-current={item.conversationId === agent.conversationId}
                disabled={agent.activity !== 'idle'}
                onClick={() => agent.selectConversation(item.conversationId)}
              />
            }
          >
            <span className='min-w-0 truncate' title={item.title}>
              {item.title}
            </span>
            <time className='shrink-0 text-xs text-muted-foreground' dateTime={item.updatedAt}>
              {new Date(item.updatedAt).toLocaleString()}
            </time>
          </DialogClose>
        ))}
        {history?.conversations.length === 0 && (
          <p className='text-muted-foreground'>暂无对话记录</p>
        )}
      </div>
      {agent.activity !== 'idle' && (
        <p className='text-muted-foreground'>运行结束或请求状态确认后可切换对话。</p>
      )}
      {loading && (
        <p role='status' className='text-muted-foreground'>
          正在加载对话…
        </p>
      )}
      {failure && (
        <Button
          variant='outline'
          onClick={() => {
            setFailure(null);
            setAttempt((value) => value + 1);
          }}
        >
          重新加载
        </Button>
      )}
      {!loading && !failure && nextOffset !== undefined && (
        <Button variant='outline' onClick={() => setOffset(nextOffset)}>
          加载更多
        </Button>
      )}
    </>
  );
};

export const AgentChatToolbar = ({
  agent,
  ...props
}: WorkspaceToolbarProps & Pick<ConversationActionsProps, 'agent'>) => {
  const [historyOpen, setHistoryOpen] = useState(false);
  return (
    <PageToolbarShell
      {...props}
      navigation='edit'
      actions={
        <>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size='icon-sm'
                  variant='ghost'
                  aria-label='新建对话'
                  disabled={agent.activity !== 'idle'}
                  onClick={() => agent.selectConversation(null)}
                />
              }
            >
              <MessageSquarePlus size={16} />
            </TooltipTrigger>
            <TooltipContent side='bottom'>新建对话</TooltipContent>
          </Tooltip>
          <Dialog open={props.active && historyOpen} onOpenChange={setHistoryOpen}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <DialogTrigger
                    render={<Button size='icon-sm' variant='ghost' aria-label='对话历史' />}
                  />
                }
              >
                <History size={16} />
              </TooltipTrigger>
              <TooltipContent side='bottom'>对话历史</TooltipContent>
            </Tooltip>
            {props.active && historyOpen && (
              <DialogContent>
                <DialogTitle>对话历史</DialogTitle>
                <ConversationHistory
                  projectId={props.projectId}
                  pageId={props.pageId}
                  agent={agent}
                />
              </DialogContent>
            )}
          </Dialog>
        </>
      }
    />
  );
};
