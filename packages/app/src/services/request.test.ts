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
    const getConnection = vi
      .fn()
      .mockResolvedValue({
        baseUrl: 'http://127.0.0.1:1234/api/v1',
        token: 'test-token',
        serviceInstanceId: 'test-instance',
      });
    vi.stubGlobal('window', { api: { backend: { getConnection } } });
    const fetch = vi
      .fn()
      .mockResolvedValue({ json: async () => ({ ok: true, data: { saved: true } }) });
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
    const fetch = vi.fn().mockResolvedValue({ json: async () => ({ ok: true, data: [] }) });
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
        json: async () => ({ ok: false, error: { message: '页面不存在' } }),
      })
      .mockRejectedValueOnce(new Error('Failed to fetch'));
    vi.stubGlobal('fetch', fetch);
    const { request } = await import('./request');
    await expect(request('/pages/missing')).rejects.toThrow('页面不存在');
    await expect(request('/workspace')).rejects.toThrow('Failed to fetch');
  });
});
