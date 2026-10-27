import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveDesktopConfig } from '../../src/main/config';
import { assertWorkbenchCaller, isTrustedWorkbenchUrl } from '../../src/main/workbench-security';

it('authorizes only the workbench main frame at the trusted document', () => {
  const entry = 'file:///Applications/Origamix/index.html';
  const frame = { url: `${entry}#/` };
  const sender = { mainFrame: frame, isDestroyed: () => false } as unknown as WebContents;
  const event = { sender, senderFrame: frame } as unknown as IpcMainInvokeEvent;
  expect(() => assertWorkbenchCaller(event, sender, entry)).not.toThrow();
  expect(() => assertWorkbenchCaller(event, undefined, entry)).toThrow('不受信任');
  expect(() =>
    assertWorkbenchCaller({ ...event, sender: {} as WebContents }, sender, entry),
  ).toThrow('不受信任');
  expect(() =>
    assertWorkbenchCaller(
      { ...event, senderFrame: { ...frame } } as IpcMainInvokeEvent,
      sender,
      entry,
    ),
  ).toThrow('不受信任');
  frame.url = 'https://untrusted.example/';
  expect(() => assertWorkbenchCaller(event, sender, entry)).toThrow('不受信任');
  expect(isTrustedWorkbenchUrl('file:///Applications/Other/index.html', entry)).toBe(false);
  expect(
    isTrustedWorkbenchUrl('http://localhost:5173.evil.example/', 'http://localhost:5173/'),
  ).toBe(false);
  expect(isTrustedWorkbenchUrl('http://localhost:5173/', 'http://localhost:5173')).toBe(true);
});

it('keeps packaged IPC authority on its shipped document despite development overrides', () => {
  const root = mkdtempSync(join(tmpdir(), 'origamix-entry-config-'));
  const mainDirectory = join(root, 'dist/main');
  mkdirSync(mainDirectory, { recursive: true });
  copyFileSync(new URL('../../.env', import.meta.url), join(root, 'dist/.env'));
  writeFileSync(join(root, '.env.local'), 'ELECTRON_RENDERER_URL=https://untrusted.example/');
  vi.stubEnv('ELECTRON_RENDERER_URL', 'https://untrusted.example/');
  vi.stubEnv('ORIGAMIX_TEMPLATE_DIR', '/untrusted/template');
  const input = { mainDirectory, resourcesPath: join(root, 'resources'), userDataPath: root };
  try {
    const config = resolveDesktopConfig({ ...input, packaged: true });
    expect(config.rendererUrl).toBeUndefined();
    expect(config.rendererPath).toBe(join(input.resourcesPath, 'app/index.html'));
    expect(config.templatePath).toBe(join(input.resourcesPath, 'template'));
    expect(() => resolveDesktopConfig({ ...input, packaged: false })).toThrow('开发页面地址');
  } finally {
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  }
});
