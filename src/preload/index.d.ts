import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      project: {
        chooseDirectory: () => Promise<string | null>
        create: (input: {
          name: string
          parentDirectory: string
        }) => Promise<{ projectPath: string }>
      }
      page: {
        create: (input: { projectPath: string; name: string; fileName: string }) => Promise<void>
      }
      settings: {
        getModel: () => Promise<{
          provider: 'deepseek'
          model: 'deepseek-v4-flash'
          hasApiKey: boolean
        }>
        saveModel: (input: {
          provider: 'deepseek'
          model: 'deepseek-v4-flash'
          apiKey?: string
        }) => Promise<{ hasApiKey: boolean }>
        getProfile: () => Promise<{ name: string; iconBackground: string }>
        saveProfile: (input: {
          name: string
          iconBackground: string
        }) => Promise<{ name: string; iconBackground: string }>
      }
    }
  }
}
