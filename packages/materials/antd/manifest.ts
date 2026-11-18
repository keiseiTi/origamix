import manifests, { basicPageManifest } from './generated/manifests';
import { MATERIAL_MANIFEST_FORMAT_VERSION, type MaterialManifestCatalog } from '@origamix/shared';
import { materialSet } from './material-set';
import { toAgentMaterialSummary, toValidationMaterialManifest } from '../src/material-manifest';

export * from './generated/manifests';

export const antdMaterialManifest: MaterialManifestCatalog = {
  formatVersion: MATERIAL_MANIFEST_FORMAT_VERSION,
  materialSet,
  materials: manifests,
};

export const antdAgentMaterialCatalog = manifests.map(toAgentMaterialSummary);

export const antdValidationMaterialRegistry = Object.fromEntries(
  [basicPageManifest, ...manifests].map((manifest) => [
    manifest.type,
    toValidationMaterialManifest(manifest),
  ]),
) as Readonly<Record<string, ReturnType<typeof toValidationMaterialManifest>>>;

export const getAntdMaterialManifests = (types: readonly string[]) => {
  const requestedTypes = new Set(types);
  return [basicPageManifest, ...manifests].filter((manifest) => requestedTypes.has(manifest.type));
};

export default antdMaterialManifest;

export { antdBlocks } from './blocks';
