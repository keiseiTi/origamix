import { Type } from '@sinclair/typebox';
import { describe, expect, it } from 'vitest';
import type { RunBudget } from '@origamix/shared/protocol/agent';
import {
  AgentToolRegistry,
  RunBudgetController,
  createDefaultAgentToolEntries,
  type ToolAuditEvent,
} from '../../../agent/tools/registry';

const budget: RunBudget = {
  maxModelCalls: 1,
  maxToolCalls: 1,
  maxOutputTokens: 10,
  maxDurationMs: 10_000,
  maxSchemaBytes: 100,
  maxRepairAttempts: 1,
};

const registry = () => {
  const value = new AgentToolRegistry();
  value.register({
    tool: {
      name: 'apply_page_operations',
      description: 'write',
      parameters: Type.Object({}),
      execute: async () => ({ revisionId: 'revision_test' }),
    },
    policy: {
      toolName: 'apply_page_operations',
      scope: 'page_write',
      risk: 'low',
      requiresConfirmation: false,
    },
  });
  return value;
};

describe('Agent tool policy and budget', () => {
  it('does not expose tools for non-Agent modes or writes for question mode', () => {
    const value = registry();
    const input = {
      runId: 'run_test',
      budget: new RunBudgetController(budget),
      audit: () => undefined,
    };
    expect(value.toolsForRun({ ...input, mode: 'out_of_scope' })).toEqual([]);
    expect(value.toolsForRun({ ...input, mode: 'page_question' })).toEqual([]);
    expect(() =>
      value.toolsForRun({
        ...input,
        mode: 'page_question',
        requestedToolNames: ['apply_page_operations'],
      }),
    ).toThrowError(expect.objectContaining({ code: 'POLICY_DENIED' }));
  });

  it('rejects forged names and audits an allowed call', async () => {
    const value = registry();
    const tracker = new RunBudgetController(budget);
    expect(() =>
      value.toolsForRun({
        runId: 'run_test',
        mode: 'page_modify',
        budget: tracker,
        requestedToolNames: ['shell'],
        audit: () => undefined,
      }),
    ).toThrowError(expect.objectContaining({ code: 'POLICY_DENIED' }));
    const audit: ToolAuditEvent[] = [];
    const [tool] = value.toolsForRun({
      runId: 'run_test',
      mode: 'page_modify',
      budget: tracker,
      audit: (event) => {
        audit.push(event);
      },
    });
    await tool!.execute({}, new AbortController().signal);
    expect(audit.map((event) => event.phase)).toEqual(['started', 'completed']);
    await expect(tool!.execute({}, new AbortController().signal)).rejects.toMatchObject({
      code: 'BUDGET_EXCEEDED',
    });
  });

  it('enforces model, output, schema, and repair budgets', () => {
    const tracker = new RunBudgetController(budget);
    tracker.consumeModelCall();
    expect(() => tracker.consumeModelCall()).toThrowError(
      expect.objectContaining({ code: 'BUDGET_EXCEEDED' }),
    );
    expect(() => tracker.recordOutputTokens(11)).toThrowError(
      expect.objectContaining({ code: 'BUDGET_EXCEEDED' }),
    );
    expect(() => tracker.assertSchemaSize({ value: 'x'.repeat(200) })).toThrowError(
      expect.objectContaining({ code: 'BUDGET_EXCEEDED' }),
    );
    tracker.consumeRepair();
    expect(() => tracker.consumeRepair()).toThrowError(
      expect.objectContaining({ code: 'BUDGET_EXCEEDED' }),
    );
  });

  it('maps only the fixed domain whitelist to policies', () => {
    const read = createDefaultAgentToolEntries([
      {
        name: 'get_page_context',
        description: 'read',
        parameters: Type.Object({}),
        execute: async () => ({}),
      },
    ]);
    expect(read[0]?.policy.scope).toBe('read');
    expect(() =>
      createDefaultAgentToolEntries([
        {
          name: 'shell',
          description: 'forged',
          parameters: Type.Object({}),
          execute: async () => ({}),
        },
      ]),
    ).toThrowError(expect.objectContaining({ code: 'POLICY_DENIED' }));
  });
});
