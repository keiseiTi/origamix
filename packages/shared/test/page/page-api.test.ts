import { Value } from '@sinclair/typebox/value';
import { describe, expect, it } from 'vitest';
import {
  ApplyWorkingOperationsSchema,
  ApplyPageSchema,
  isApplyPageResult,
  isPageApplyState,
} from '@/page/page-api';
import { ApiResultSchema, isApiResultEnvelope } from '@/transport/api-result';

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
        expectedWorkingVersion: 2,
        clientRequestId: 'request_One-2',
      }),
    ).toBe(true);
    expect(
      Value.Check(ApplyPageSchema, {
        expectedRevisionId: 'revision_one',
        expectedWorkingVersion: 2,
        clientRequestId: '../../outside',
      }),
    ).toBe(false);
  });

  it('validates apply state and result response data', () => {
    const hash = 'a'.repeat(64);
    expect(
      isPageApplyState({
        pageId: 'page_one',
        savedRevisionId: 'revision_one',
        workingVersion: 2,
        status: 'saved_pending_apply',
        workingHash: hash,
        savedSchemaHash: hash,
        targetSchemaHash: hash,
        baselineHash: hash,
      }),
    ).toBe(true);
    expect(
      isPageApplyState({
        pageId: 'page_one',
        savedRevisionId: 'revision_one',
        workingVersion: 2,
        status: 'unknown',
        workingHash: hash,
        savedSchemaHash: hash,
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

describe('Working Schema request protocol', () => {
  it('requires a non-empty typed Operation List', () => {
    expect(
      Value.Check(ApplyWorkingOperationsSchema, {
        baseWorkingVersion: 2,
        operations: [
          { operation: 'updateElementProps', elementId: 'element_root', set: { padding: 12 } },
        ],
      }),
    ).toBe(true);
    expect(
      Value.Check(ApplyWorkingOperationsSchema, {
        baseWorkingVersion: 2,
        operations: [],
      }),
    ).toBe(false);
  });
});
