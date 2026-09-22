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
      name: 'complete_page_run',
      description: 'write',
      parameters: Type.Object({}),
      execute: async () => ({ revisionId: 'revision_test' }),
    },
    policy: {
      toolName: 'complete_page_run',
      scope: 'page_write',
      risk: 'low',
      requiresConfirmation: false,
    },
  });
  return value;
};

describe('Agent tool policy and budget', () => {
  it('exposes the same terminal capability for every page-assistant run', () => {
    const value = registry();
    const input = {
      runId: 'run_test',
      budget: new RunBudgetController(budget),
      audit: () => undefined,
    };
    expect(value.toolsForRun(input).map(({ name }) => name)).toEqual(['complete_page_run']);
  });

  it('rejects forged names and audits an allowed call', async () => {
    const value = registry();
    const tracker = new RunBudgetController(budget);
    expect(() =>
      value.toolsForRun({
        runId: 'run_test',
        budget: tracker,
        requestedToolNames: ['shell'],
        audit: () => undefined,
      }),
    ).toThrowError(expect.objectContaining({ code: 'POLICY_DENIED' }));
    const audit: ToolAuditEvent[] = [];
    const [tool] = value.toolsForRun({
      runId: 'run_test',
      budget: tracker,
      audit: (event) => {
        audit.push(event);
      },
    });
    await tool!.execute(
      {
        operations: [
          { operation: 'updateElementProps', elementId: 'secret', set: { text: '私密' } },
        ],
      },
      new AbortController().signal,
    );
    expect(audit.map((event) => event.phase)).toEqual(['started', 'completed']);
    expect(audit[1]).toMatchObject({
      operationCount: 1,
      operationTypeCounts: { updateElementProps: 1 },
    });
    expect(JSON.stringify(audit)).not.toContain('私密');
    await expect(tool!.execute({}, new AbortController().signal)).rejects.toMatchObject({
      code: 'POLICY_DENIED',
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
          name: 'legacy_write_tool',
          description: 'unregistered model-visible write',
          parameters: Type.Object({}),
          execute: async () => ({}),
        },
      ]),
    ).toThrowError(expect.objectContaining({ code: 'POLICY_DENIED' }));
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
