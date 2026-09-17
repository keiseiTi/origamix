import { create } from 'zustand';
import type { CreateAgentRunRequest } from '@origamix/shared/protocol/agent';

export const pageOperationKey = (projectId: string, pageId: string): string =>
  JSON.stringify([projectId, pageId]);

type ApplyRequest = {
  revisionId: string;
  workingVersion: number;
  clientRequestId: string;
  inFlight: boolean;
};
type AgentRequest = { input: CreateAgentRunRequest; inFlight: boolean };

interface PendingOperations {
  applies: Record<string, ApplyRequest>;
  agents: Record<string, AgentRequest>;
  setApply: (key: string, request: ApplyRequest) => void;
  finishApply: (key: string, requestId: string, confirmed: boolean) => void;
  setAgent: (key: string, request: AgentRequest) => void;
  finishAgent: (key: string, requestId: string, confirmed: boolean) => void;
}

// Window memory only. Unmounting a view must not discard an unresolved mutation.
// Settled requests are removed; uncertain requests survive until explicit retry.
export const usePendingOperations = create<PendingOperations>((set) => ({
  applies: {},
  agents: {},
  setApply: (key, request) => set((state) => ({ applies: { ...state.applies, [key]: request } })),
  finishApply: (key, requestId, confirmed) =>
    set((state) => {
      const request = state.applies[key];
      if (request?.clientRequestId !== requestId) return state;
      const applies = { ...state.applies };
      if (confirmed) delete applies[key];
      else applies[key] = { ...request, inFlight: false };
      return { applies };
    }),
  setAgent: (key, request) => set((state) => ({ agents: { ...state.agents, [key]: request } })),
  finishAgent: (key, requestId, confirmed) =>
    set((state) => {
      const request = state.agents[key];
      if (request?.input.clientRequestId !== requestId) return state;
      const agents = { ...state.agents };
      if (confirmed) delete agents[key];
      else agents[key] = { ...request, inFlight: false };
      return { agents };
    }),
}));
