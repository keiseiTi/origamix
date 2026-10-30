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
    await expect(request('/agent/runs/get')).resolves.toEqual({
      recovered: true,
    });
    expect(getConnection).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:1002/api/v1/agent/runs/get',
      expect.objectContaining({
        method: 'POST',
        body: '{}',
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
    const data = { clientRequestId: 'stable-id' };
    await expect(request('/agent/runs/create', data)).rejects.toThrow('socket closed');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:1001/api/v1/agent/runs/create',
      expect.objectContaining({ method: 'POST', body: '{"clientRequestId":"stable-id"}' }),
    );
    await expect(request('/agent/runs/create', data)).resolves.toEqual({
      runId: 'existing-run',
    });
    expect(getConnection).toHaveBeenCalledTimes(2);
  });
  it('rejects a late old-instance mutation result and preserves its explicit retry identity', async () => {
    let notify!: (status: 'ready' | 'restarting' | 'unavailable') => void;
    const unsubscribe = vi.fn();
    const old = { baseUrl: 'http://127.0.0.1:1029/api/v1', token: 'old', serviceInstanceId: 'old' };
    const next = { ...old, token: 'new', serviceInstanceId: 'new' };
    const getConnection = vi.fn().mockResolvedValueOnce(old).mockResolvedValue(next);
    vi.stubGlobal('window', {
      api: {
        backend: {
          getConnection,
          onStatusChanged: (listener: typeof notify) => {
            notify = listener;
            return unsubscribe;
          },
        },
      },
    });
    let resolveResponse!: (response: unknown) => void;
    const response = new Promise((resolve) => {
      resolveResponse = resolve;
    });
    const fetch = vi
      .fn()
      .mockReturnValueOnce(response)
      .mockResolvedValue({
        status: 200,
        json: async () => ({ success: true, code: 200, data: { recovered: true } }),
      });
    vi.stubGlobal('fetch', fetch);
    const transport = await import('../../src/services/request');
    const stop = transport.watchBackendConnection();
    const input = { clientRequestId: 'retained-identity' };
    const write = transport.request('/pages/apply', input);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    notify('restarting');
    await expect(transport.request('/pages/apply', input)).rejects.toThrow('后端正在重启');
    notify('ready');
    await vi.waitFor(() => expect(getConnection).toHaveBeenCalledTimes(2));
    const check = expect(write).rejects.toBeInstanceOf(transport.BackendConnectionChangedError);
    resolveResponse({ status: 200, json: async () => ({ success: true, code: 200, data: {} }) });
    await check;
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(transport.request('/pages/apply', input)).resolves.toEqual({ recovered: true });
    expect(fetch).toHaveBeenLastCalledWith(
      next.baseUrl + '/pages/apply',
      expect.objectContaining({
        body: JSON.stringify(input),
        headers: expect.objectContaining({ Authorization: 'Bearer new' }),
      }),
    );
    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
    notify('restarting');
    await expect(transport.getApiConnection()).resolves.toEqual(next);
  });

  it('never caches an old getConnection reply after a restart notification', async () => {
    let notify!: (status: 'ready' | 'restarting') => void;
    let resolveOld!: (value: unknown) => void;
    const old = new Promise((resolve) => {
      resolveOld = resolve;
    });
    const next = {
      baseUrl: 'http://127.0.0.1:1029/api/v1',
      token: 'new',
      serviceInstanceId: 'new',
    };
    const getConnection = vi.fn().mockReturnValueOnce(old).mockResolvedValue(next);
    vi.stubGlobal('window', {
      api: {
        backend: {
          getConnection,
          onStatusChanged: (listener: typeof notify) => {
            notify = listener;
            return () => undefined;
          },
        },
      },
    });
    const transport = await import('../../src/services/request');
    const stop = transport.watchBackendConnection();
    const pending = transport.getApiConnection();
    const check = expect(pending).rejects.toBeInstanceOf(transport.BackendConnectionChangedError);
    notify('restarting');
    notify('ready');
    await expect(transport.getApiConnection()).resolves.toEqual(next);
    resolveOld({ ...next, token: 'old', serviceInstanceId: 'old' });
    await check;
    await expect(transport.getApiConnection()).resolves.toEqual(next);
    stop();
  });
  it('reconnects SSE with fresh authority and ignores events from the replaced stream', async () => {
    let notify!: (status: 'ready' | 'restarting') => void;
    const old = { baseUrl: 'http://127.0.0.1:1029/api/v1', token: 'old', serviceInstanceId: 'old' };
    const getConnection = vi
      .fn()
      .mockResolvedValueOnce(old)
      .mockResolvedValue({ ...old, token: 'new', serviceInstanceId: 'new' });
    vi.stubGlobal('window', {
      api: {
        backend: {
          getConnection,
          onStatusChanged: (listener: typeof notify) => {
            notify = listener;
            return () => undefined;
          },
        },
      },
    });
    let oldStream!: ReadableStreamDefaultController<Uint8Array>;
    let newStream!: ReadableStreamDefaultController<Uint8Array>;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        body: new ReadableStream({
          start: (controller) => {
            oldStream = controller;
          },
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        body: new ReadableStream({
          start: (controller) => {
            newStream = controller;
          },
        }),
      });
    vi.stubGlobal('fetch', fetch);
    const transport = await import('../../src/services/request');
    const stopWatch = transport.watchBackendConnection();
    const { subscribeAgentEvents } = await import('../../src/services/agent');
    const onEvent = vi.fn();
    const onOpen = vi.fn();
    const onError = vi.fn();
    const stopStream = subscribeAgentEvents('project_one', 'run_one', { onOpen, onEvent, onError });
    const event = (eventId: number) =>
      new TextEncoder().encode(
        'data: ' +
          JSON.stringify({
            version: '1',
            eventId,
            sequence: eventId,
            type: 'run.progress',
            runId: 'run_one',
            pageId: 'page_one',
            requestId: 'request-one',
            occurredAt: '2026-01-01T00:00:00.000Z',
            payload: { status: 'reading', phase: 'reading', message: '正在读取' },
          }) +
          '\n\n',
      );
    await vi.waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1));
    oldStream.enqueue(event(9));
    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledTimes(1));
    notify('restarting');
    expect(fetch.mock.calls[0]![1].signal.aborted).toBe(true);
    notify('ready');
    await vi.waitFor(() => expect(onOpen).toHaveBeenCalledTimes(2));
    expect(fetch.mock.calls[1]![0]).toContain('afterEventId=-1');
    expect(fetch.mock.calls[1]![1].headers.Authorization).toBe('Bearer new');
    oldStream.enqueue(event(10));
    newStream.enqueue(event(0));
    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledTimes(2));
    expect(onEvent.mock.calls[1]![0].eventId).toBe(0);
    expect(onError).not.toHaveBeenCalled();
    stopStream();
    stopWatch();
    oldStream.close();
    newStream.close();
  });
});
