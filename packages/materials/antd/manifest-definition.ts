import type { JsonSchema, MaterialManifest } from '@/material-manifest';

export const objectSchema = (
  properties: Readonly<Record<string, JsonSchema>>,
  required: readonly string[] = [],
): JsonSchema => ({
  type: 'object',
  additionalProperties: false,
  properties,
  ...(required.length > 0 ? { required } : {}),
});

type MaterialCore = Pick<MaterialManifest, 'type' | 'title' | 'defaultProps' | 'context'>;
type ManifestDetails = Omit<MaterialManifest, keyof MaterialCore>;

export function defineManifest(core: MaterialCore, details: ManifestDetails): MaterialManifest {
  return { ...core, ...details };
}
