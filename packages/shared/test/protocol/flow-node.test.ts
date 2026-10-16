import { describe, expect, it } from 'vitest';
import { Value } from '@sinclair/typebox/value';
import { FlowValueReferenceSchema, getFlowNodeManifest } from '../../src/protocol/flow-node';

describe('flow node configuration contract', () => {
  it('accepts request configuration and rejects unsupported methods, bounds and fields', () => {
    const manifest = getFlowNodeManifest('interfaceRequest')!;
    const request = { ...manifest.defaultProps, url: 'https://example.com/items' };
    expect(Value.Check(manifest.propsSchema, request)).toBe(true);
    expect(Value.Check(manifest.propsSchema, { ...request, method: 'trace' })).toBe(false);
    expect(Value.Check(manifest.propsSchema, { ...request, url: 123 })).toBe(false);
    expect(Value.Check(manifest.propsSchema, { ...request, timeout: 99 })).toBe(false);
    expect(Value.Check(manifest.propsSchema, { ...request, credentials: 'include' })).toBe(false);
  });

  it('accepts explicit node-result references and rejects ambiguous reference shapes', () => {
    expect(
      Value.Check(FlowValueReferenceSchema, {
        $ref: 'result',
        name: 'request_orders',
        path: 'data.items',
      }),
    ).toBe(true);
    expect(Value.Check(FlowValueReferenceSchema, { $ref: 'result', path: 'data.items' })).toBe(
      false,
    );
    expect(Value.Check(FlowValueReferenceSchema, { $ref: 'expression', name: 'eval' })).toBe(false);
  });
});
