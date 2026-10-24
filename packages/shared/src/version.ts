/** Unified release contract. Updated with every workspace package by release:version. */
export const ORIGAMIX_VERSION = '1.0.0' as const;
export const ORIGAMIX_RELEASES: readonly string[] = ['1.0.0'];
export const isSupportedOrigamixVersion = (value: unknown): value is string =>
  typeof value === 'string' && ORIGAMIX_RELEASES.includes(value);
