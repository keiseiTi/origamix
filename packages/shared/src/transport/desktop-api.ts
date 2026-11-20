export type BackendStatus = 'restarting' | 'ready' | 'unavailable';

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
  provider: string;
  model: string;
  hasApiKey: boolean;
}

export interface ModelProviderOption {
  id: string;
  name: string;
  models: readonly { id: string; name: string }[];
}

export interface DesktopApi {
  platform: 'darwin' | 'other';
  backend: {
    getConnection(): Promise<BackendConnection>;
    onStatusChanged(listener: (status: BackendStatus) => void): () => void;
  };
  dialog: {
    chooseProjectParent(): Promise<DirectoryGrant | null>;
    chooseExistingProject(): Promise<DirectoryGrant | null>;
  };
  settings: {
    getModel(): Promise<ModelSettings>;
    getModelProviders(): Promise<readonly (ModelProviderOption & { hasApiKey: boolean })[]>;
    saveModel(
      input: Omit<ModelSettings, 'hasApiKey'> & { apiKey?: string },
    ): Promise<{ hasApiKey: boolean }>;
    getProfile(): Promise<UserProfile>;
    saveProfile(input: UserProfile): Promise<UserProfile>;
  };
}
