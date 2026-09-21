import type { TSchema } from '@sinclair/typebox';

export const DEEPSEEK_FLASH_MODEL_ID = 'deepseek/deepseek-flash' as const;
export const DEEPSEEK_V4_PRO_MODEL_ID = 'deepseek/deepseek-v4-pro' as const;
export const MVP_MODEL_ID = DEEPSEEK_FLASH_MODEL_ID;
export const FAKE_MODEL_ID = 'fake/deterministic-mvp' as const;

export type AgentEngineErrorCode =
  | 'MODEL_NOT_FOUND'
  | 'CAPABILITY_UNSUPPORTED'
  | 'PROVIDER_ERROR'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'BUDGET_EXCEEDED'
  | 'POLICY_DENIED'
  | 'TOOL_ERROR';

export class AgentEngineError extends Error {
  constructor(
    readonly code: AgentEngineErrorCode,
    safeMessage: string,
    readonly retryable = false,
  ) {
    super(safeMessage);
    this.name = 'AgentEngineError';
  }
}

export interface AgentModelDefinition {
  id: string;
  provider: string;
  model: string;
  capabilities: {
    streaming: boolean;
    tools: boolean;
    abort: boolean;
  };
}

const models = new Map<string, AgentModelDefinition>([
  [
    FAKE_MODEL_ID,
    {
      id: FAKE_MODEL_ID,
      provider: 'fake',
      model: 'deterministic-mvp',
      capabilities: { streaming: true, tools: true, abort: true },
    },
  ],
  [
    MVP_MODEL_ID,
    {
      id: MVP_MODEL_ID,
      provider: 'deepseek',
      model: 'deepseek-flash',
      capabilities: { streaming: true, tools: true, abort: true },
    },
  ],
  [
    DEEPSEEK_V4_PRO_MODEL_ID,
    {
      id: DEEPSEEK_V4_PRO_MODEL_ID,
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      capabilities: { streaming: true, tools: true, abort: true },
    },
  ],
]);

export const getAgentModel = (modelId: string): AgentModelDefinition => {
  const model = models.get(modelId);
  if (!model) throw new AgentEngineError('MODEL_NOT_FOUND', '所选模型不可用');
  return model;
};

export const requireModelCapability = (
  model: AgentModelDefinition,
  capability: keyof AgentModelDefinition['capabilities'],
): void => {
  if (!model.capabilities[capability]) {
    throw new AgentEngineError('CAPABILITY_UNSUPPORTED', '所选模型不支持此能力');
  }
};

export interface AgentEngineTool {
  name: string;
  description: string;
  parameters: TSchema;
  execute: (input: unknown, signal: AbortSignal) => Promise<unknown>;
}

export type AgentEngineEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_start'; toolCallId: string; toolName: string; input: unknown }
  | { type: 'tool_end'; toolCallId: string; toolName: string; result: unknown; isError: boolean }
  | { type: 'completed'; text: string; usage: AgentEngineUsage }
  | { type: 'failed'; error: AgentEngineError };

export interface AgentEngineUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AgentEngineRequest {
  modelId: string;
  systemPrompt: string;
  prompt: string;
  tools?: AgentEngineTool[];
  signal?: AbortSignal;
  timeoutMs?: number;
  onEvent?: (event: AgentEngineEvent) => void | Promise<void>;
}

export interface AgentEngineResult {
  text: string;
  usage: AgentEngineUsage;
}

export interface AgentEngine {
  run(request: AgentEngineRequest): Promise<AgentEngineResult>;
}
