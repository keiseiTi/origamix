import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('renderer transport', () => {
  it('refreshes stale desktop authority once after a service-instance rejection', async () => {
    const getConnection = vi
      .fn()
      .mockResolvedValueOnce({
        baseUrl: 'http://127.0.0.1:1001/api/v1',
        token: 'old-token',
        serviceInstanceId: 'old-instance',
      })
      .mockResolvedValueOnce({
        baseUrl: 'http://127.0.0.1:1002/api/v1',
        token: 'new-token',
        serviceInstanceId: 'new-instance',
      });
    vi.stubGlobal('window', { api: { backend: { getConnection } } });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        status: 401,
        json: async () => ({ success: false, code: 401, data: null, message: '服务实例已失效' }),
      })
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({ success: true, code: 200, data: { recovered: true } }),
      });
    vi.stubGlobal('fetch', fetch);

    const { request } = await import('../../src/services/request');
    await expect(request('/agent/runs/run_one')).resolves.toEqual({ recovered: true });
    expect(getConnection).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:1002/api/v1/agent/runs/run_one',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer new-token',
          'x-origamix-service': 'new-instance',
        }),
      }),
    );
  });

  it('does not replay an ambiguous mutation after a network failure but refreshes its next retry', async () => {
    const getConnection = vi
      .fn()
      .mockResolvedValueOnce({
        baseUrl: 'http://127.0.0.1:1001/api/v1',
        token: 'old',
        serviceInstanceId: 'old',
      })
      .mockResolvedValueOnce({
        baseUrl: 'http://127.0.0.1:1002/api/v1',
        token: 'new',
        serviceInstanceId: 'new',
      });
    vi.stubGlobal('window', { api: { backend: { getConnection } } });
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('socket closed'))
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({ success: true, code: 200, data: { runId: 'existing-run' } }),
      });
    vi.stubGlobal('fetch', fetch);

    const { request } = await import('../../src/services/request');
    const init = { method: 'POST', body: '{"clientRequestId":"stable-id"}' };
    await expect(request('/agent/runs', init)).rejects.toThrow('socket closed');
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(request('/agent/runs', init)).resolves.toEqual({ runId: 'existing-run' });
    expect(getConnection).toHaveBeenCalledTimes(2);
  });
});
