import { useCallback, useRef, useState, type Dispatch } from 'react';
import type { AgentChatAction } from './agent-chat-state';
import type { AgentMessage } from '@origamix/shared';
import { listMessages } from '@/services/agent';

type ConversationMessages = {
  conversationId: string;
  messages: AgentMessage[];
  hasOlder: boolean;
};

const mergeMessages = (existing: AgentMessage[], incoming: AgentMessage[]): AgentMessage[] => {
  const byId = new Map(existing.map((message) => [message.messageId, message]));
  for (const message of incoming) byId.set(message.messageId, message);
  return [...byId.values()].sort((a, b) => a.sequence - b.sequence);
};

const readConversationMessages = async (
  projectId: string,
  pageId: string,
  conversationId: string,
  existing: ConversationMessages | null,
  current: () => boolean,
): Promise<ConversationMessages> => {
  const last = existing?.messages.at(-1);
  if (!existing || existing.conversationId !== conversationId || !last) {
    const page = await listMessages(projectId, pageId, conversationId);
    return { conversationId, messages: page.messages, hasOlder: page.hasMore };
  }

  const incoming: AgentMessage[] = [];
  // Reread the last known message to pick up any finalized assistant content.
  let afterSequence = last.sequence - 1;
  while (current()) {
    const page = await listMessages(projectId, pageId, conversationId, { afterSequence });
    incoming.push(...page.messages);
    const next = page.messages.at(-1)?.sequence;
    if (!page.hasMore || next === undefined || next <= afterSequence) break;
    afterSequence = next;
  }
  return { ...existing, messages: mergeMessages(existing.messages, incoming) };
};

export const useConversationMessages = (
  projectId: string,
  pageId: string,
  captureSession: () => () => boolean,
  dispatch: Dispatch<AgentChatAction>,
) => {
  const messages = useRef<ConversationMessages | null>(null);
  const olderRequest = useRef<symbol | null>(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);

  const readMessages = useCallback(
    (id: string, current: () => boolean) =>
      readConversationMessages(projectId, pageId, id, messages.current, current),
    [pageId, projectId],
  );

  const retainMessages = useCallback((history: ConversationMessages) => {
    const existing = messages.current;
    const hasOlder =
      existing?.conversationId === history.conversationId &&
      (existing.messages[0]?.sequence ?? Infinity) < (history.messages[0]?.sequence ?? Infinity)
        ? existing.hasOlder
        : history.hasOlder;
    const combined =
      existing?.conversationId === history.conversationId
        ? mergeMessages(existing.messages, history.messages)
        : history.messages;
    messages.current = { ...history, messages: combined, hasOlder };
    setHasOlderMessages(hasOlder);
    return combined;
  }, []);

  const clearMessages = useCallback(() => {
    messages.current = null;
    olderRequest.current = null;
    setHasOlderMessages(false);
    setLoadingOlderMessages(false);
  }, []);

  const loadOlderMessages = async (): Promise<void> => {
    const existing = messages.current;
    const first = existing?.messages[0];
    if (!existing?.hasOlder || !first || olderRequest.current) return;
    const token = Symbol();
    const isSessionCurrent = captureSession();
    const isCurrent = () => isSessionCurrent() && olderRequest.current === token;
    olderRequest.current = token;
    setLoadingOlderMessages(true);
    try {
      const page = await listMessages(projectId, pageId, existing.conversationId, {
        beforeSequence: first.sequence,
      });
      if (!isCurrent()) return;
      const latest = messages.current;
      if (!latest || latest.conversationId !== existing.conversationId) return;
      messages.current = {
        ...latest,
        messages: mergeMessages(page.messages, latest.messages),
        hasOlder: page.hasMore,
      };
      setHasOlderMessages(page.hasMore);
      dispatch({
        type: 'messages.prepended',
        conversationId: existing.conversationId,
        messages: page.messages,
      });
    } finally {
      if (isCurrent()) {
        olderRequest.current = null;
        setLoadingOlderMessages(false);
      }
    }
  };

  return {
    readMessages,
    retainMessages,
    clearMessages,
    loadOlderMessages,
    hasOlderMessages,
    loadingOlderMessages,
  };
};
