import { contextBridge, ipcRenderer } from 'electron';
import type { PreviewSnapshot } from '../shared/page-window';

// No desktop credentials, write operations, arbitrary paths or raw IPC in previews.
contextBridge.exposeInMainWorld('preview', {
  readSnapshot: (): Promise<PreviewSnapshot> => ipcRenderer.invoke('preview:read-snapshot')
});
