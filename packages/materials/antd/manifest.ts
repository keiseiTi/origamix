import {
  basicPageManifest,
  buttonManifest,
  cascaderManifest,
  checkboxManifest,
  containerManifest,
  datePickerManifest,
  datePickerRangeManifest,
  drawerManifest,
  formManifest,
  inputManifest,
  modalManifest,
  numberManifest,
  radioManifest,
  selectManifest,
  sliderManifest,
  switchManifest,
  tableManifest,
  tabsManifest,
  textManifest,
  textareaManifest,
  timePickerManifest,
  treeManifest,
  treeSelectManifest,
  uploadManifest,
} from './generated/manifests';
import { MATERIAL_MANIFEST_FORMAT_VERSION, type MaterialManifestCatalog } from '@origamix/shared';
import { materialSet } from './material-set';
import { toAgentMaterialSummary, toValidationMaterialManifest } from '../src/material-manifest';

export {
  basicPageManifest,
  buttonManifest,
  cascaderManifest,
  checkboxManifest,
  containerManifest,
  datePickerManifest,
  datePickerRangeManifest,
  drawerManifest,
  formManifest,
  inputManifest,
  modalManifest,
  numberManifest,
  radioManifest,
  selectManifest,
  sliderManifest,
  switchManifest,
  tableManifest,
  tabsManifest,
  textManifest,
  textareaManifest,
  timePickerManifest,
  treeManifest,
  treeSelectManifest,
  uploadManifest,
};

const manifests = [
  containerManifest,
  formManifest,
  inputManifest,
  numberManifest,
  checkboxManifest,
  radioManifest,
  selectManifest,
  textareaManifest,
  datePickerManifest,
  datePickerRangeManifest,
  timePickerManifest,
  switchManifest,
  treeSelectManifest,
  cascaderManifest,
  sliderManifest,
  uploadManifest,
  buttonManifest,
  modalManifest,
  drawerManifest,
  tableManifest,
  tabsManifest,
  textManifest,
  treeManifest,
] as const;

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
