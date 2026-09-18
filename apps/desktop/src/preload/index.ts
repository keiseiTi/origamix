import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi } from '@origamix/shared/desktop-api';

// Custom APIs for renderer
const api: DesktopApi = {
  platform: process.platform === 'darwin' ? 'darwin' : 'other',
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
