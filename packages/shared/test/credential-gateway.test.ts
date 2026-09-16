import { describe, expect, it } from 'vitest';
import { isCredentialRequest, isCredentialResponse } from '../src/credential-gateway';

describe('credential gateway protocol', () => {
  it('accepts only the fixed server caller, reference and purposes', () => {
    const request = {
      version: '1',
      requestId: 'request-one',
      caller: 'server-agent',
      credentialRef: 'model.deepseek.api-key',
      purpose: 'agent.model-request',
    };
    expect(isCredentialRequest(request)).toBe(true);
    expect(isCredentialRequest({ ...request, caller: 'renderer' })).toBe(false);
    expect(isCredentialRequest({ ...request, credentialRef: 'arbitrary.secret' })).toBe(false);
    expect(isCredentialRequest({ ...request, provider: 'arbitrary' })).toBe(false);
  });

  it('validates success without exposing enumeration and known failure outcomes', () => {
    expect(
      isCredentialResponse({
        version: '1',
        requestId: 'request-one',
        success: true,
        credential: 'secret',
      }),
    ).toBe(true);
    for (const code of [
      'INVALID_CALLER',
      'UNKNOWN_CREDENTIAL_REF',
      'DUPLICATE_REQUEST',
      'TIMEOUT',
      'GATEWAY_CLOSING',
    ]) {
      expect(
        isCredentialResponse({ version: '1', requestId: 'request-one', success: false, code }),
      ).toBe(true);
    }
    expect(
      isCredentialResponse({
        version: '1',
        requestId: 'request-one',
        success: false,
        code: 'UNKNOWN',
      }),
    ).toBe(false);
  });
});
