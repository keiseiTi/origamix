import type { PageWindowInput, PreviewSnapshot } from '@origamix/shared/page-window';

declare global {
  interface Window {
    preview: { readSnapshot: () => Promise<PreviewSnapshot> };
    api: {
      window: { openPage: (input: PageWindowInput) => Promise<void> };
      backend: { getConnection: () => Promise<{ baseUrl: string; token: string; serviceInstanceId: string }> };
      dialog: {
        chooseProjectParent: () => Promise<{ directoryGrantId: string; displayPath: string } | null>;
        chooseExistingProject: () => Promise<{ directoryGrantId: string; displayPath: string } | null>;
      };
      settings: {
        getModel: () => Promise<{ provider: 'deepseek'; model: 'deepseek-v4-flash'; hasApiKey: boolean }>;
        saveModel: (input: { provider: 'deepseek'; model: 'deepseek-v4-flash'; apiKey?: string }) => Promise<{ hasApiKey: boolean }>;
        getProfile: () => Promise<{ name: string; iconBackground: string }>;
        saveProfile: (input: { name: string; iconBackground: string }) => Promise<{ name: string; iconBackground: string }>;
      };
    };
  }
}

export {};
