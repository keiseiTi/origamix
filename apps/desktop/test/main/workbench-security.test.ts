import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { expect, it } from 'vitest';
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
