import type { DesktopApi } from '@origamix/shared/desktop-api';

declare global {
  interface Window {
    api?: DesktopApi;
  }
}
