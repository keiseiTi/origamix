import { contextBridge, ipcRenderer } from 'electron';

// Custom APIs for renderer
const api = {
  window: {
    openPage: (input: import('@origamix/shared/page-window').PageWindowInput): Promise<void> =>
      ipcRenderer.invoke('window:open-page', input)
  },
  backend: {
    getConnection: (): Promise<{ baseUrl: string; token: string; serviceInstanceId: string }> =>
      ipcRenderer.invoke('backend:get-connection')
  },
  dialog: {
    chooseProjectParent: (): Promise<{ directoryGrantId: string; displayPath: string } | null> =>
      ipcRenderer.invoke('dialog:choose-project-parent'),
    chooseExistingProject: (): Promise<{ directoryGrantId: string; displayPath: string } | null> =>
      ipcRenderer.invoke('dialog:choose-existing-project')
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
    }): Promise<{ hasApiKey: boolean }> =>
      ipcRenderer.invoke('settings:model:save', input),
    getProfile: (): Promise<{ name: string; iconBackground: string }> =>
      ipcRenderer.invoke('settings:profile:get'),
    saveProfile: (input: {
      name: string;
      iconBackground: string;
    }): Promise<{ name: string; iconBackground: string }> =>
      ipcRenderer.invoke('settings:profile:save', input)
  }
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-expect-error Window API is declared for Renderer consumers.
  window.api = api;
}
