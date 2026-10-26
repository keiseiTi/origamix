import { describe, expect, it } from 'vitest';
import { HyperValueSchema } from '../../src/flow/hyper-value.ts';

import { Value } from '@sinclair/typebox/value';
import { getFlowNodeManifest } from '../../src/flow/flow-node-manifest.ts';

describe('flow node configuration contract', () => {
  it('accepts request configuration and rejects unsupported methods and fields', () => {
    const manifest = getFlowNodeManifest('interfaceRequest')!;
    const request = {
      ...manifest.defaultProps,
      url: { type: 'string', value: 'https://example.com/items' },
    };
    expect(Value.Check(manifest.propsSchema, request)).toBe(true);
    expect(Value.Check(manifest.propsSchema, { ...request, method: 'trace' })).toBe(false);
    expect(Value.Check(manifest.propsSchema, { ...request, url: 123 })).toBe(false);
    expect(
      Value.Check(manifest.propsSchema, { ...request, headers: { type: 'json', value: {} } }),
    ).toBe(false);
    expect(Value.Check(manifest.propsSchema, { ...request, credentials: 'include' })).toBe(false);
  });

  it('accepts typed values and function bindings and rejects invalid envelopes', () => {
    expect(
      Value.Check(HyperValueSchema, { type: 'contextValue', value: 'result.request.data.items' }),
    ).toBe(true);
    expect(
      Value.Check(HyperValueSchema, {
        type: 'function',
        value: { params: [{ name: 'items', value: 'global.items' }], body: 'return items.length;' },
      }),
    ).toBe(true);
    expect(Value.Check(HyperValueSchema, { type: 'number', value: '123' })).toBe(false);
    expect(
      Value.Check(HyperValueSchema, { type: 'function', value: { params: [], body: 123 } }),
    ).toBe(false);
    expect(
      Value.Check(HyperValueSchema, { type: 'expression', value: '1 + 2', credentials: 'host' }),
    ).toBe(false);
  });
});
