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
    }
  }
}
