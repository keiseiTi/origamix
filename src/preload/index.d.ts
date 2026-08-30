import { ElectronAPI } from '@electron-toolkit/preload';

declare global {
  interface Window {
    electron: ElectronAPI;
    api: {
      backend: {
        getConnection: () => Promise<{ baseUrl: string; token: string; serviceInstanceId: string }>;
      };
      dialog: {
        chooseProjectParent: () => Promise<{
          directoryGrantId: string;
          displayPath: string;
        } | null>;
        chooseExistingProject: () => Promise<{
          directoryGrantId: string;
          displayPath: string;
        } | null>;
      };
      settings: {
        getModel: () => Promise<{
          provider: 'deepseek';
          model: 'deepseek-v4-flash';
          hasApiKey: boolean;
        }>;
        saveModel: (input: {
          provider: 'deepseek';
          model: 'deepseek-v4-flash';
          apiKey?: string;
        }) => Promise<{ hasApiKey: boolean }>;
        getProfile: () => Promise<{ name: string; iconBackground: string }>;
        saveProfile: (input: {
          name: string;
          iconBackground: string;
        }) => Promise<{ name: string; iconBackground: string }>;
      };
    };
  }
}
