import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.doUnmock('./request');
  vi.unstubAllGlobals();
});

describe('Agent service', () => {
  it('loads every message page instead of stopping at the first 100 messages', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        version: '1',
        messages: Array.from({ length: 100 }, (_, sequence) => ({ sequence })),
      })
      .mockResolvedValueOnce({ version: '1', messages: [{ sequence: 100 }] });
    vi.doMock('./request', () => ({
      request,
      getApiConnection: vi.fn(),
      refreshBackendConnection: vi.fn(),
    }));
    const { listAllMessages } = await import('./agent');
    const result = await listAllMessages('project_test', 'page_test', 'conversation_test');
    expect(result.messages).toHaveLength(101);
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/conversations/conversation_test/messages',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-origamix-after-sequence': '99' }),
      }),
    );
  });

  it('parses authenticated SSE and deduplicates replayed event ids', async () => {
    vi.stubGlobal('window', {
      api: {
        backend: {
          getConnection: vi.fn().mockResolvedValue({
            baseUrl: 'http://127.0.0.1:1234/api/v1',
            token: 'token',
            serviceInstanceId: 'instance',
          }),
        },
      },
    });
    const event = {
      version: '1',
      eventId: 2,
      sequence: 2,
      type: 'run.completed',
      runId: 'run_test',
      pageId: 'page_test',
      requestId: 'request',
      occurredAt: '2026-01-01T00:00:00.000Z',
      payload: {},
    };
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            `id: 2\nevent: run.completed\ndata: ${JSON.stringify(event)}\n\n` +
              `id: 2\nevent: run.completed\ndata: ${JSON.stringify(event)}\n\n`,
          ),
        );
        controller.close();
      },
    });
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, body: stream });
    vi.stubGlobal('fetch', fetch);
    const onEvent = vi.fn();
    const onClose = vi.fn();
    const { subscribeAgentEvents } = await import('./agent');
    subscribeAgentEvents('project_test', 'run_test', { afterEventId: 1, onEvent, onClose });
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:1234/api/v1/agent/runs/run_test/events?afterEventId=1',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
          'last-event-id': '1',
        }),
      }),
    );
  });
});
