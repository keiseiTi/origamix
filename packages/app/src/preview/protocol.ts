import {
  isApplicationSnapshot,
  isApplicationRenderReport,
  type ApplicationRenderReport,
  type ApplicationSnapshot,
} from '@origamix/shared';

export interface PreviewIdentity {
  pageId: string;
  projectId: string;
}

export type PreviewToHostMessage =
  | ({ type: 'origamix.preview.ready' } & PreviewIdentity)
  | ({ type: 'origamix.preview.outcome'; report: ApplicationRenderReport } & PreviewIdentity);

export type HostToPreviewMessage =
  | ({ type: 'origamix.preview.snapshot'; snapshot: ApplicationSnapshot } & PreviewIdentity)
  | ({ type: 'origamix.preview.error'; message: string } & PreviewIdentity);

const hasIdentity = (value: unknown): value is Record<string, unknown> & PreviewIdentity =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as PreviewIdentity).projectId === 'string' &&
  typeof (value as PreviewIdentity).pageId === 'string';

export const isPreviewToHostMessage = (value: unknown): value is PreviewToHostMessage =>
  hasIdentity(value) &&
  (value.type === 'origamix.preview.ready' ||
    (value.type === 'origamix.preview.outcome' && isApplicationRenderReport(value.report)));

export const isHostToPreviewMessage = (value: unknown): value is HostToPreviewMessage =>
  hasIdentity(value) &&
  ((value.type === 'origamix.preview.snapshot' && isApplicationSnapshot(value.snapshot)) ||
    (value.type === 'origamix.preview.error' && typeof value.message === 'string'));
