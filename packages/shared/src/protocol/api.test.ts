import { Value } from '@sinclair/typebox/value';
import { describe, expect, it } from 'vitest';
import {
  ApiResultSchema,
  ApplyPageSchema,
  isApiResultEnvelope,
  isApplyPageResult,
  isPageApplyState,
} from './api';

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

  it('validates apply state and result response data', () => {
    const hash = 'a'.repeat(64);
    expect(
      isPageApplyState({
        pageId: 'page_one',
        workingRevisionId: 'revision_one',
        status: 'pending',
        workingSchemaHash: hash,
        targetSchemaHash: hash,
        baselineHash: hash,
      }),
    ).toBe(true);
    expect(
      isPageApplyState({
        pageId: 'page_one',
        workingRevisionId: 'revision_one',
        status: 'unknown',
        workingSchemaHash: hash,
        targetSchemaHash: hash,
        baselineHash: hash,
      }),
    ).toBe(false);
    expect(
      isApplyPageResult({
        pageId: 'page_one',
        revisionId: 'revision_one',
        schemaHash: hash,
        appliedAt: '2026-09-11T00:00:00.000Z',
        status: 'applied',
      }),
    ).toBe(true);
  });
});
