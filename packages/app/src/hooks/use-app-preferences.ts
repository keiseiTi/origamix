import { useEffect } from 'react';
import { usePreferencesStore } from '@/store/preferences';

export const useAppPreferences = (): void => {
  const theme = usePreferencesStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    window.api?.settings
      ?.getProfile?.()
      .then(usePreferencesStore.getState().setUserProfile)
      .catch(() => undefined);

    window.api?.settings
      ?.getModel?.()
      .then((settings) => usePreferencesStore.getState().setHasModelApiKey(settings.hasApiKey))
      .catch(() => usePreferencesStore.getState().setHasModelApiKey(undefined));
  }, []);
};
