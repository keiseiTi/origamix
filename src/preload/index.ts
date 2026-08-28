import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  project: {
    chooseDirectory: (): Promise<string | null> =>
      electronAPI.ipcRenderer.invoke('project:choose-directory'),
    create: (input: { name: string; parentDirectory: string }): Promise<{ projectPath: string }> =>
      electronAPI.ipcRenderer.invoke('project:create', input)
  },
  page: {
    create: (input: { projectPath: string; name: string; fileName: string }): Promise<void> =>
      electronAPI.ipcRenderer.invoke('page:create', input)
  },
  settings: {
    getModel: (): Promise<{
      provider: 'deepseek'
      model: 'deepseek-v4-flash'
      hasApiKey: boolean
    }> => electronAPI.ipcRenderer.invoke('settings:model:get'),
    saveModel: (input: {
      provider: 'deepseek'
      model: 'deepseek-v4-flash'
      apiKey?: string
    }): Promise<{ hasApiKey: boolean }> =>
      electronAPI.ipcRenderer.invoke('settings:model:save', input),
    getProfile: (): Promise<{ name: string; iconBackground: string }> =>
      electronAPI.ipcRenderer.invoke('settings:profile:get'),
    saveProfile: (input: {
      name: string
      iconBackground: string
    }): Promise<{ name: string; iconBackground: string }> =>
      electronAPI.ipcRenderer.invoke('settings:profile:save', input)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
