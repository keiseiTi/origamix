import { contextBridge, ipcRenderer } from 'electron';
import type {
  PreviewRenderReport,
  PreviewRenderResult,
  PreviewSnapshot,
} from '@origamix/shared/page-window';

// No desktop credentials, write operations, arbitrary paths or raw IPC in previews.
contextBridge.exposeInMainWorld('preview', {
  readSnapshot: (): Promise<PreviewSnapshot> => ipcRenderer.invoke('preview:read-snapshot'),
  reportRender: (report: PreviewRenderReport): Promise<PreviewRenderResult> =>
    ipcRenderer.invoke('preview:report-render', report),
  exit: (): Promise<void> => ipcRenderer.invoke('preview:exit'),
});
