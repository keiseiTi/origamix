import {
  LayoutManifest,
  LayoutRegionManifest,
  PageOutletManifest,
  containerManifest,
  textManifest,
  buttonManifest,
} from '../generated/manifests';
import { MATERIAL_MANIFEST_FORMAT_VERSION, type MaterialManifestCatalog } from '@origamix/shared';
import { materialSet } from '../material-set';
import { toAgentMaterialSummary, toValidationMaterialManifest } from '../../src/material-manifest';
export const antdLayoutManifest: MaterialManifestCatalog = {
  formatVersion: MATERIAL_MANIFEST_FORMAT_VERSION,
  materialSet,
  materials: [
    LayoutManifest,
    LayoutRegionManifest,
    PageOutletManifest,
    containerManifest,
    textManifest,
    buttonManifest,
  ].map((material) => ({
    ...material,
    context: { variables: [], writable: [], actions: [], events: [] },
  })),
};
export const antdLayoutAgentCatalog = antdLayoutManifest.materials.map(toAgentMaterialSummary);
export const antdLayoutValidationRegistry = Object.fromEntries(
  antdLayoutManifest.materials.map((material) => [
    material.type,
    toValidationMaterialManifest(material),
  ]),
);
export {
  layoutDefaults,
  layoutRegionIds,
  reconcileAntdLayoutSchema,
  assertAntdLayoutSchema,
  createAntdLayoutSchema,
} from './schema';
