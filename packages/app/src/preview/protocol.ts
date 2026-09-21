import type { PreviewRenderDiagnostic, PreviewSnapshot } from '@origamix/shared/page-window';

export interface PreviewIdentity {
  pageId: string;
  projectId: string;
}

export type PreviewToHostMessage =
  | ({ type: 'origamix.preview.ready' } & PreviewIdentity)
  | ({
      type: 'origamix.preview.outcome';
      revisionId: string;
      outcome: 'success' | 'failed';
      diagnostics: PreviewRenderDiagnostic[];
    } & PreviewIdentity);

export type HostToPreviewMessage =
  | ({ type: 'origamix.preview.snapshot'; snapshot: PreviewSnapshot } & PreviewIdentity)
  | ({ type: 'origamix.preview.error'; message: string } & PreviewIdentity);

export const isPreviewToHostMessage = (value: unknown): value is PreviewToHostMessage => {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return (
    (message.type === 'origamix.preview.ready' ||
      message.type === 'origamix.preview.outcome') &&
    typeof message.projectId === 'string' &&
    typeof message.pageId === 'string'
  );
};

export const isHostToPreviewMessage = (value: unknown): value is HostToPreviewMessage => {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return (
    (message.type === 'origamix.preview.snapshot' ||
      message.type === 'origamix.preview.error') &&
    typeof message.projectId === 'string' &&
    typeof message.pageId === 'string'
  );
};
