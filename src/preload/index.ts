import { contextBridge } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

// Custom APIs for renderer
const api = {
  window: {
    openPage: (input: import('../shared/page-window').PageWindowInput): Promise<void> =>
      electronAPI.ipcRenderer.invoke('window:open-page', input)
  },
  backend: {
    getConnection: (): Promise<{ baseUrl: string; token: string; serviceInstanceId: string }> =>
      electronAPI.ipcRenderer.invoke('backend:get-connection')
  },
  dialog: {
    chooseProjectParent: (): Promise<{ directoryGrantId: string; displayPath: string } | null> =>
      electronAPI.ipcRenderer.invoke('dialog:choose-project-parent'),
    chooseExistingProject: (): Promise<{ directoryGrantId: string; displayPath: string } | null> =>
      electronAPI.ipcRenderer.invoke('dialog:choose-existing-project')
  },
  settings: {
    getModel: (): Promise<{
      provider: 'deepseek';
      model: 'deepseek-v4-flash';
      hasApiKey: boolean;
    }> => electronAPI.ipcRenderer.invoke('settings:model:get'),
    saveModel: (input: {
      provider: 'deepseek';
      model: 'deepseek-v4-flash';
      apiKey?: string;
    }): Promise<{ hasApiKey: boolean }> =>
      electronAPI.ipcRenderer.invoke('settings:model:save', input),
    getProfile: (): Promise<{ name: string; iconBackground: string }> =>
      electronAPI.ipcRenderer.invoke('settings:profile:get'),
    saveProfile: (input: {
      name: string;
      iconBackground: string;
    }): Promise<{ name: string; iconBackground: string }> =>
      electronAPI.ipcRenderer.invoke('settings:profile:save', input)
  }
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
