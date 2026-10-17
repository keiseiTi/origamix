import { create } from 'zustand';

export type AppTheme = 'light' | 'dark';

export interface UserProfile {
  name: string;
  iconBackground: string;
}

interface PreferencesState {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  theme: AppTheme;
  userProfile: UserProfile;
  hasModelApiKey: boolean | undefined;
  setTheme: (theme: AppTheme) => void;
  setUserProfile: (profile: UserProfile) => void;
  setHasModelApiKey: (configured: boolean | undefined) => void;
}

const readTheme = (): AppTheme => {
  try {
    return localStorage.getItem('origamix:theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

const sidebarStorageKey = 'origamix:sidebar-collapsed';

const readSidebarCollapsed = (): boolean => {
  try {
    const stored = sessionStorage.getItem(sidebarStorageKey);
    if (stored !== null) return stored === 'true';
    return false;
  } catch {
    return false;
  }
};

export const usePreferencesStore = create<PreferencesState>((set) => ({
  sidebarCollapsed: readSidebarCollapsed(),
  setSidebarCollapsed: (sidebarCollapsed) => {
    try {
      sessionStorage.setItem(sidebarStorageKey, String(sidebarCollapsed));
    } catch {
      // Keep the window preference usable when storage is unavailable.
    }
    set({ sidebarCollapsed });
  },
  theme: readTheme(),
  userProfile: { name: 'Origamix 用户', iconBackground: '#2563eb' },
  hasModelApiKey: undefined,
  setTheme: (theme) => {
    try {
      localStorage.setItem('origamix:theme', theme);
    } catch {
      // The in-memory preference remains usable when storage is unavailable.
    }
    set({ theme });
  },
  setUserProfile: (userProfile) => set({ userProfile }),
  setHasModelApiKey: (hasModelApiKey) => set({ hasModelApiKey }),
}));
