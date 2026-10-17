import type { DesktopApi } from '@origamix/shared';

declare global {
  interface Window {
    api?: DesktopApi;
  }
}
