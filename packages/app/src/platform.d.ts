import type { DesktopApi, PreviewApi } from '@origamix/shared/desktop-api';

declare global {
  interface Window {
    api?: DesktopApi;
    preview?: PreviewApi;
  }
}
