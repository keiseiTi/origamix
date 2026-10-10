import { useEffect } from 'react';
import { isMacDesktop } from '@/utils';

const macDesktop = isMacDesktop();

export const useGlobalShortcuts = (openSettings: () => void): void => {
  useEffect(() => {
    const handleSettingsShortcut = (event: KeyboardEvent): void => {
      const primaryModifierPressed = macDesktop ? event.metaKey : event.ctrlKey;
      if (!primaryModifierPressed || event.altKey || event.shiftKey || event.code !== 'Comma')
        return;
      event.preventDefault();
      event.stopPropagation();
      openSettings();
    };
    window.addEventListener('keydown', handleSettingsShortcut, { capture: true });
    return () => window.removeEventListener('keydown', handleSettingsShortcut, { capture: true });
  }, [openSettings]);
};
