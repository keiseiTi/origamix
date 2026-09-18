import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exposed: new Map<string, unknown>(),
  invoke: vi.fn(),
}));

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (name: string, value: unknown) => mocks.exposed.set(name, value),
  },
  ipcRenderer: {
    invoke: mocks.invoke,
  },
}));

describe('workbench preload boundary', () => {
  beforeEach(() => {
    mocks.exposed.clear();
    mocks.invoke.mockReset();
    vi.resetModules();
  });

  it('does not expose preview-window controls to iframe previews', async () => {
    await import('../../src/preload/index');
    const api = mocks.exposed.get('api') as Record<string, unknown>;

    expect(api).toBeTruthy();
    expect(api).not.toHaveProperty('window');
    expect(api).toHaveProperty('backend');
    expect(api).toHaveProperty('dialog');
    expect(api).toHaveProperty('settings');
  });
});
