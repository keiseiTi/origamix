import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@origamix/ui';
import { MessageSquarePlus } from 'lucide-react';
import type { AgentChatSession } from '@/components/agent-chat/use-agent-chat';
import { ConversationHistoryDialog } from '@/components/agent-chat/conversation-history-dialog';
import { PageToolbarShell, type PageToolbarProps } from './page-toolbar';

export type WorkspaceToolbarProps = Omit<
  PageToolbarProps,
  'navigation' | 'children' | 'onOpenEditorTool'
>;

export const AgentChatToolbar = ({
  agent,
  ...props
}: WorkspaceToolbarProps & {
  agent: Pick<
    AgentChatSession,
    'activity' | 'conversationId' | 'selectConversation' | 'otherActiveConversationId'
  >;
}) => (
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
        <ConversationHistoryDialog
          active={props.active}
          projectId={props.projectId}
          pageId={props.pageId}
          agent={agent}
        />
      </>
    }
  />
);
