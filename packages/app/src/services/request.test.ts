import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('renderer transport', () => {
  it('uses the desktop bridge and forwards authentication and project scope', async () => {
    const getConnection = vi.fn().mockResolvedValue({
      baseUrl: 'http://127.0.0.1:1234/api/v1',
      token: 'test-token',
      serviceInstanceId: 'test-instance',
    });
    vi.stubGlobal('window', { api: { backend: { getConnection } } });
    const fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ success: true, code: 200, data: { saved: true } }),
    });
    vi.stubGlobal('fetch', fetch);
    const { request } = await import('./request');
    expect(
      await request('/workspace', { method: 'PATCH', projectId: 'project-one', body: '{}' }),
    ).toEqual({ saved: true });
    await request('/projects');
    expect(getConnection).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:1234/api/v1/workspace',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'x-origamix-service': 'test-instance',
          'x-origamix-project-id': 'project-one',
          'content-type': 'application/json',
        }),
      }),
    );
  });

  it('uses the same-origin development proxy without client credentials', async () => {
    vi.stubEnv('DEV', true);
    vi.stubGlobal('window', {});
    const fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ success: true, code: 200, data: [] }),
    });
    vi.stubGlobal('fetch', fetch);
    const { request } = await import('./request');
    await request('/projects');
    expect(fetch).toHaveBeenCalledWith('/api/v1/projects', { headers: {} });
  });

  it('does not silently switch a production browser to the development proxy', async () => {
    vi.stubEnv('DEV', false);
    vi.stubGlobal('window', {});
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { request } = await import('./request');
    await expect(request('/workspace')).rejects.toThrow('当前环境不支持本地服务');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('surfaces API and network failures to the UI', async () => {
    vi.stubEnv('DEV', true);
    vi.stubGlobal('window', {});
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        status: 404,
        json: async () => ({ success: false, code: 404, data: null, message: '页面不存在' }),
      })
      .mockRejectedValueOnce(new Error('Failed to fetch'));
    vi.stubGlobal('fetch', fetch);
    const { ApiRequestError, request } = await import('./request');
    const apiError = await request('/pages/missing').catch((error: unknown) => error);
    expect(apiError).toBeInstanceOf(ApiRequestError);
    expect(apiError).toMatchObject({ message: '页面不存在', code: 404, status: 404 });
    await expect(request('/workspace')).rejects.toThrow('Failed to fetch');
  });

  it('rejects malformed service envelopes', async () => {
    vi.stubEnv('DEV', true);
    vi.stubGlobal('window', {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 200, json: async () => ({ data: 'missing metadata' }) }),
    );
    const { ApiRequestError, request } = await import('./request');
    const error = await request('/workspace').catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ message: '服务返回格式无效', code: 500, status: 200 });
  });

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

    const { request } = await import('./request');
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

    const { request } = await import('./request');
    const init = { method: 'POST', body: '{"clientRequestId":"stable-id"}' };
    await expect(request('/agent/runs', init)).rejects.toThrow('socket closed');
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(request('/agent/runs', init)).resolves.toEqual({ runId: 'existing-run' });
    expect(getConnection).toHaveBeenCalledTimes(2);
  });
});
