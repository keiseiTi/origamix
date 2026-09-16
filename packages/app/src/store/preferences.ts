import { create } from 'zustand';

export type AppTheme = 'light' | 'dark';

export interface UserProfile {
  name: string;
  iconBackground: string;
}

interface PreferencesState {
  theme: AppTheme;
  userProfile: UserProfile;
  setTheme: (theme: AppTheme) => void;
  setUserProfile: (profile: UserProfile) => void;
}

const readTheme = (): AppTheme => {
  try {
    return localStorage.getItem('origamix:theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

export const usePreferencesStore = create<PreferencesState>((set) => ({
  theme: readTheme(),
  userProfile: { name: 'Origamix 用户', iconBackground: '#2563eb' },
  setTheme: (theme) => {
    try {
      localStorage.setItem('origamix:theme', theme);
    } catch {
      // The in-memory preference remains usable when storage is unavailable.
    }
    set({ theme });
  },
  setUserProfile: (userProfile) => set({ userProfile }),
}));
