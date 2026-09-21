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
  model: 'deepseek-flash' | 'deepseek-v4-pro';
  hasApiKey: boolean;
}
export interface DesktopApi {
  platform: 'darwin' | 'other';
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
