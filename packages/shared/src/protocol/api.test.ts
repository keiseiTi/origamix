import { Value } from '@sinclair/typebox/value';
import { describe, expect, it } from 'vitest';
import { ApiResultSchema, ApplyPageSchema, isApiResultEnvelope } from './api';

describe('API result protocol', () => {
  it('accepts the success and failure envelopes', () => {
    expect(
      Value.Check(ApiResultSchema, { success: true, code: 200, data: { id: 'project_one' } }),
    ).toBe(true);
    expect(isApiResultEnvelope({ success: true, code: 200, data: null })).toBe(true);
    expect(
      Value.Check(ApiResultSchema, {
        success: false,
        code: 422,
        data: null,
        message: '项目名称无效',
      }),
    ).toBe(true);
  });

  it('rejects legacy, incomplete and contradictory envelopes', () => {
    expect(Value.Check(ApiResultSchema, { ok: true, data: {} })).toBe(false);
    expect(Value.Check(ApiResultSchema, { success: true, code: 201, data: {} })).toBe(false);
    expect(Value.Check(ApiResultSchema, { success: true, code: 200 })).toBe(false);
    expect(Value.Check(ApiResultSchema, { success: false, code: 404, data: { stale: true } })).toBe(
      false,
    );
  });
});

describe('Apply request protocol', () => {
  it('accepts opaque safe IDs and rejects path characters', () => {
    expect(
      Value.Check(ApplyPageSchema, {
        expectedRevisionId: 'revision_one',
        clientRequestId: 'request_One-2',
      }),
    ).toBe(true);
    expect(
      Value.Check(ApplyPageSchema, {
        expectedRevisionId: 'revision_one',
        clientRequestId: '../../outside',
      }),
    ).toBe(false);
  });
});
