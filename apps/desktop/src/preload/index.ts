import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi } from '@origamix/shared/desktop-api';

// Custom APIs for renderer
const api: DesktopApi = {
  platform: process.platform === 'darwin' ? 'darwin' : 'other',
  window: {
    openPage: (input: import('@origamix/shared/page-window').PageWindowInput): Promise<void> =>
      ipcRenderer.invoke('window:open-page', input),
    closePreview: (input: import('@origamix/shared/page-window').PageWindowInput): Promise<void> =>
      ipcRenderer.invoke('window:close-preview', input),
    setPreviewBounds: (
      bounds: import('@origamix/shared/page-window').PreviewBounds,
    ): Promise<void> => ipcRenderer.invoke('window:set-preview-bounds', bounds),
    onPreviewExited: (
      listener: (input: import('@origamix/shared/page-window').PageWindowInput) => void,
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        input: import('@origamix/shared/page-window').PageWindowInput,
      ): void => listener(input);
      ipcRenderer.on('preview:exited', handler);
      return () => ipcRenderer.removeListener('preview:exited', handler);
    },
  },
  backend: {
    getConnection: (): Promise<{ baseUrl: string; token: string; serviceInstanceId: string }> =>
      ipcRenderer.invoke('backend:get-connection'),
  },
  dialog: {
    chooseProjectParent: (): Promise<{ directoryGrantId: string; displayPath: string } | null> =>
      ipcRenderer.invoke('dialog:choose-project-parent'),
    chooseExistingProject: (): Promise<{ directoryGrantId: string; displayPath: string } | null> =>
      ipcRenderer.invoke('dialog:choose-existing-project'),
  },
  settings: {
    getModel: (): Promise<{
      provider: 'deepseek';
      model: 'deepseek-v4-flash';
      hasApiKey: boolean;
    }> => ipcRenderer.invoke('settings:model:get'),
    saveModel: (input: {
      provider: 'deepseek';
      model: 'deepseek-v4-flash';
      apiKey?: string;
    }): Promise<{ hasApiKey: boolean }> => ipcRenderer.invoke('settings:model:save', input),
    getProfile: (): Promise<{ name: string; iconBackground: string }> =>
      ipcRenderer.invoke('settings:profile:get'),
    saveProfile: (input: {
      name: string;
      iconBackground: string;
    }): Promise<{ name: string; iconBackground: string }> =>
      ipcRenderer.invoke('settings:profile:save', input),
  },
};

contextBridge.exposeInMainWorld('api', api);
