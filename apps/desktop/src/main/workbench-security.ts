import type { IpcMainInvokeEvent, WebContents } from 'electron';

export const isTrustedWorkbenchUrl = (value: string, entryUrl: string): boolean => {
  try {
    const candidate = new URL(value);
    const entry = new URL(entryUrl);
    candidate.hash = '';
    entry.hash = '';
    return candidate.href === entry.href;
  } catch {
    return false;
  }
};

export const assertWorkbenchCaller = (
  event: IpcMainInvokeEvent,
  workbench: WebContents | undefined,
  entryUrl: string,
): void => {
  if (
    !workbench ||
    workbench.isDestroyed() ||
    event.sender !== workbench ||
    event.senderFrame !== workbench.mainFrame ||
    !isTrustedWorkbenchUrl(event.senderFrame.url, entryUrl)
  )
    throw new Error('不受信任的桌面调用来源');
};
