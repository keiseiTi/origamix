import type { PageWindowInput, PreviewBounds, PreviewSnapshot } from './page-window';

export interface BackendConnection {
  baseUrl: string;
  token: string;
  serviceInstanceId: string;
}
export interface DirectoryGrant {
  directoryGrantId: string;
  displayPath: string;
}
export interface UserProfile {
  name: string;
  iconBackground: string;
}
export interface ModelSettings {
  provider: 'deepseek';
  model: 'deepseek-v4-flash';
  hasApiKey: boolean;
}
export interface DesktopApi {
  window: {
    openPage(input: PageWindowInput): Promise<void>;
    closePreview(input: PageWindowInput): Promise<void>;
    setPreviewBounds(bounds: PreviewBounds): Promise<void>;
    onPreviewExited(listener: (input: PageWindowInput) => void): () => void;
  };
  backend: { getConnection(): Promise<BackendConnection> };
  dialog: {
    chooseProjectParent(): Promise<DirectoryGrant | null>;
    chooseExistingProject(): Promise<DirectoryGrant | null>;
  };
  settings: {
    getModel(): Promise<ModelSettings>;
    saveModel(
      input: Omit<ModelSettings, 'hasApiKey'> & { apiKey?: string },
    ): Promise<{ hasApiKey: boolean }>;
    getProfile(): Promise<UserProfile>;
    saveProfile(input: UserProfile): Promise<UserProfile>;
  };
}
export interface PreviewApi {
  readSnapshot(): Promise<PreviewSnapshot>;
  exit(): Promise<void>;
}
