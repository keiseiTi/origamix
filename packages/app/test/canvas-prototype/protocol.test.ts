import { describe, expect, it } from 'vitest';
import { isRequest, isReply, type Scope } from '../../src/canvas-prototype/protocol';
import { sample } from '../../src/canvas-prototype/sample';
const scope: Scope = {
  protocol: 1,
  instanceId: 'active',
  projectId: 'prototype',
  pageId: 'sample',
};
// The new untrusted-frame boundary must reject stale/cross-page commands and executable snapshots.
// Server tests cannot cover a browser MessagePort, and this prototype never calls Server.
describe('canvas prototype capability boundary', () => {
  it('accepts only scoped finite commands and bounded non-executable snapshots', () => {
    const command = {
      ...scope,
      commandId: 1,
      version: 0,
      command: { kind: 'update', id: 'button', field: 'text', value: '更新' },
    };
    expect(isRequest(command, scope)).toBe(true);
    for (const patch of [
      { instanceId: 'old' },
      { pageId: 'other' },
      { command: { kind: 'apply' } },
      { command: { kind: 'add', materialType: 'unknown', x: 1, y: 1 } },
      { command: { kind: 'hover', x: Infinity, y: 1 } },
      { url: 'file:///private' },
    ])
      expect(isRequest({ ...command, ...patch }, scope)).toBe(false);
    const reply = {
      ...scope,
      kind: 'snapshot',
      commandId: 1,
      version: 1,
      snapshot: { schema: sample, selectedId: 'button', canUndo: true, canRedo: false },
    };
    expect(isReply(reply, scope)).toBe(true);
    expect(isReply({ ...reply, instanceId: 'old' }, scope)).toBe(false);
    expect(
      isReply({ ...reply, snapshot: { ...reply.snapshot, selectedId: 'missing' } }, scope),
    ).toBe(false);
    expect(
      isReply(
        {
          ...reply,
          snapshot: {
            ...reply.snapshot,
            schema: {
              ...sample,
              bindElements: [{ id: 'button', event: 'onClick', flowId: 'untrusted' }],
            },
          },
        },
        scope,
      ),
    ).toBe(false);
  });
});
