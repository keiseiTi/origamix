import {
  isPagePreviewSnapshot,
  isPagePreviewReport,
  type PagePreviewReport,
  type PagePreviewSnapshot,
} from '@origamix/shared';

export interface PreviewIdentity {
  pageId: string;
  projectId: string;
}

export type PreviewToHostMessage =
  | ({ type: 'origamix.preview.ready' } & PreviewIdentity)
  | ({ type: 'origamix.preview.outcome'; report: PagePreviewReport } & PreviewIdentity);

export type HostToPreviewMessage = {
  type: 'origamix.preview.snapshot';
  snapshot: PagePreviewSnapshot;
} & PreviewIdentity;

const hasIdentity = (value: unknown): value is Record<string, unknown> & PreviewIdentity =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as PreviewIdentity).projectId === 'string' &&
  typeof (value as PreviewIdentity).pageId === 'string';

export const isPreviewToHostMessage = (value: unknown): value is PreviewToHostMessage =>
  hasIdentity(value) &&
  (value.type === 'origamix.preview.ready' ||
    (value.type === 'origamix.preview.outcome' && isPagePreviewReport(value.report)));

export const isHostToPreviewMessage = (value: unknown): value is HostToPreviewMessage =>
  hasIdentity(value) &&
  value.type === 'origamix.preview.snapshot' &&
  isPagePreviewSnapshot(value.snapshot) &&
  value.snapshot.pageId === value.pageId;
