import { useEffect } from 'react';

export const useGlobalShortcuts = (isMacDesktop: boolean, openSettings: () => void): void => {
  useEffect(() => {
    const handleSettingsShortcut = (event: KeyboardEvent): void => {
      const primaryModifierPressed = isMacDesktop ? event.metaKey : event.ctrlKey;
      if (!primaryModifierPressed || event.altKey || event.shiftKey || event.code !== 'Comma')
        return;
      event.preventDefault();
      event.stopPropagation();
      openSettings();
    };
    window.addEventListener('keydown', handleSettingsShortcut, { capture: true });
    return () => window.removeEventListener('keydown', handleSettingsShortcut, { capture: true });
  }, [isMacDesktop, openSettings]);
};
