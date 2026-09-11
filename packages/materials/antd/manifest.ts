import {
  MATERIAL_MANIFEST_FORMAT_VERSION,
  toAgentMaterialSummary,
  toValidationMaterialManifest,
  type MaterialManifestCatalog,
} from '@/material-manifest';
import { buttonManifest } from './button/manifest';
import { cascaderManifest } from './cascader/manifest';
import { checkboxManifest } from './checkbox/manifest';
import { containerManifest } from './container/manifest';
import { datePickerManifest } from './date-picker/manifest';
import { datePickerRangeManifest } from './date-picker-range/manifest';
import { drawerManifest } from './drawer/manifest';
import { formManifest } from './form/manifest';
import { inputManifest } from './input/manifest';
import { modalManifest } from './modal/manifest';
import { numberManifest } from './number/manifest';
import { radioManifest } from './radio/manifest';
import { selectManifest } from './select/manifest';
import { sliderManifest } from './slider/manifest';
import { switchManifest } from './switch/manifest';
import { tableManifest } from './table/manifest';
import { textManifest } from './text/manifest';
import { textareaManifest } from './textarea/manifest';
import { timePickerManifest } from './time-picker/manifest';
import { treeManifest } from './tree/manifest';
import { treeSelectManifest } from './tree-select/manifest';
import { uploadManifest } from './upload/manifest';

export {
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
  textManifest,
  treeManifest,
] as const;

export const antdMaterialManifest: MaterialManifestCatalog = {
  formatVersion: MATERIAL_MANIFEST_FORMAT_VERSION,
  materialSet: { id: 'official-antd', version: '1.0.0' },
  materials: manifests,
};

export const antdAgentMaterialCatalog = manifests.map(toAgentMaterialSummary);

export const antdValidationMaterialRegistry = Object.fromEntries(
  manifests.map((manifest) => [manifest.type, toValidationMaterialManifest(manifest)]),
) as Readonly<Record<string, ReturnType<typeof toValidationMaterialManifest>>>;

export const getAntdMaterialManifests = (types: readonly string[]) => {
  const requestedTypes = new Set(types);
  return manifests.filter((manifest) => requestedTypes.has(manifest.type));
};

export default antdMaterialManifest;
