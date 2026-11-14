import { RunBudgetSchema, type RunBudget } from '@origamix/shared';
import { Value } from '@sinclair/typebox/value';

export const DEFAULT_AGENT_RUN_BUDGET: RunBudget = {
  maxModelCalls: 30,
  maxToolCalls: 80,
  maxInputTokens: 800_000,
  maxOutputTokens: 64_000,
  maxTotalTokens: 864_000,
  maxRequestInputTokens: 128_000,
  maxRequestOutputTokens: 24_000,
  maxDurationMs: 300_000,
  maxSchemaBytes: 512 * 1024,
  maxOperationBytes: 256 * 1024,
  maxRepairAttempts: 2,
};

/** Trusted host configuration only; never read budgets from model/tool arguments. */
export const resolveAgentRunBudget = (profile = 'standard', overrides?: string): RunBudget => {
  if (!['standard', 'complex'].includes(profile))
    throw new Error('Agent budget profile must be standard or complex');
  const base =
    profile === 'complex'
      ? {
          ...DEFAULT_AGENT_RUN_BUDGET,
          maxModelCalls: 60,
          maxToolCalls: 160,
          maxInputTokens: 2_000_000,
          maxOutputTokens: 128_000,
          maxTotalTokens: 2_128_000,
          maxRequestOutputTokens: 32_000,
          maxDurationMs: 600_000,
        }
      : DEFAULT_AGENT_RUN_BUDGET;
  let parsed: unknown = {};
  try {
    if (overrides) parsed = JSON.parse(overrides);
  } catch {
    throw new Error('Agent budget overrides must be a JSON object');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('Agent budget overrides must be a JSON object');
  const result = { ...base, ...parsed };
  if (
    !Value.Check(RunBudgetSchema, result) ||
    Object.values(result).some((value) => !Number.isSafeInteger(value) || value < 0) ||
    result.maxDurationMs > 2_147_483_647 ||
    result.maxRequestInputTokens! > result.maxInputTokens! ||
    result.maxRequestOutputTokens! > result.maxOutputTokens ||
    result.maxTotalTokens! < result.maxRequestInputTokens! + result.maxRequestOutputTokens!
  )
    throw new Error('Agent budget configuration is invalid or inconsistent');
  return result;
};
