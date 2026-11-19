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

// Earlier entries are retained first when the Agent's material context is truncated.
const agentMaterialPriority = [
  'container',
  'form',
  'input',
  'number',
  'checkbox',
  'radio',
  'select',
  'textarea',
  'datePicker',
  'datePickerRange',
  'timePicker',
  'switch',
  'treeSelect',
  'cascader',
  'slider',
  'upload',
  'button',
  'modal',
  'drawer',
  'table',
  'tabs',
  'text',
  'tree',
];
const agentMaterialRank = new Map(agentMaterialPriority.map((type, index) => [type, index]));
const rank = (type: string) => agentMaterialRank.get(type) ?? agentMaterialRank.size;

export const antdAgentMaterialCatalog = [...manifests]
  .sort((left, right) => rank(left.type) - rank(right.type))
  .map(toAgentMaterialSummary);

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
