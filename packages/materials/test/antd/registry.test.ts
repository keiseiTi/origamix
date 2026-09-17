import { describe, expect, it } from 'vitest';
import materialGroups from '../../antd/group';
import materialComponents from '../../antd/index';
import {
  antdAgentMaterialCatalog,
  antdMaterialManifest,
  antdValidationMaterialRegistry,
  getAntdMaterialManifests,
} from '../../antd/manifest';
import { buttonManifest } from '../../antd/button/manifest';
import { cascaderManifest } from '../../antd/cascader/manifest';
import { checkboxManifest } from '../../antd/checkbox/manifest';
import { containerManifest } from '../../antd/container/manifest';
import { datePickerManifest } from '../../antd/date-picker/manifest';
import { datePickerRangeManifest } from '../../antd/date-picker-range/manifest';
import { drawerManifest } from '../../antd/drawer/manifest';
import { formManifest } from '../../antd/form/manifest';
import { inputManifest } from '../../antd/input/manifest';
import { modalManifest } from '../../antd/modal/manifest';
import { numberManifest } from '../../antd/number/manifest';
import { radioManifest } from '../../antd/radio/manifest';
import { selectManifest } from '../../antd/select/manifest';
import { sliderManifest } from '../../antd/slider/manifest';
import { switchManifest } from '../../antd/switch/manifest';
import { tableManifest } from '../../antd/table/manifest';
import { textManifest } from '../../antd/text/manifest';
import { textareaManifest } from '../../antd/textarea/manifest';
import { timePickerManifest } from '../../antd/time-picker/manifest';
import { treeManifest } from '../../antd/tree/manifest';
import { treeSelectManifest } from '../../antd/tree-select/manifest';
import { uploadManifest } from '../../antd/upload/manifest';
import { buttonDefinition } from '../../antd/button/definition';
import BasicPageMaterial from '../../antd/basic-page/material-config';
import { inputDefinition } from '../../antd/input/definition';
import TabsMaterial from '../../antd/tabs/material-config';
import { basicPageManifest } from '../../antd/basic-page/manifest';
import { tabsManifest } from '../../antd/tabs/manifest';
import {
  isOrigamixEditorMaterial,
  toEditorMaterial,
  toMaterialManifest,
} from '../../src/origamix-material';

const materialOwnedManifests = [
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

const expectPureData = (value: unknown): void => {
  expect(typeof value).not.toBe('function');
  if (Array.isArray(value)) {
    value.forEach(expectPureData);
    return;
  }
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(expectPureData);
  }
};

describe('antd material registry', () => {
  it('derives migrated editor materials and manifests from serializable definitions', () => {
    for (const definition of [buttonDefinition, inputDefinition]) {
      expectPureData(definition);
      expect(toMaterialManifest(definition)).toMatchObject({
        type: definition.type,
        title: definition.title,
        defaultProps: definition.defaultProps,
        context: definition.context,
      });
      const editorMaterial = toEditorMaterial(definition, (() => null) as never);
      expect(editorMaterial).toMatchObject({
        type: definition.type,
        title: definition.title,
        defaultProps: definition.defaultProps,
      });
      expect(editorMaterial.dropTypes).toEqual(toMaterialManifest(definition).allowedParentTypes);
    }
  });

  it('supports runtime-only page and tabs materials without publishing them to the Agent catalog', () => {
    expect(isOrigamixEditorMaterial(BasicPageMaterial)).toBe(true);
    expect(isOrigamixEditorMaterial(TabsMaterial)).toBe(true);
    expectPureData(basicPageManifest);
    expectPureData(tabsManifest);
    expect(antdMaterialManifest.materials).not.toContainEqual(basicPageManifest);
    expect(antdMaterialManifest.materials).not.toContainEqual(tabsManifest);
  });

  it('keeps palette material types unique and registered at runtime', () => {
    const types = materialGroups.flatMap((group) =>
      group.children.map((material) => material.type),
    );

    expect(new Set(types).size).toBe(types.length);
    for (const type of types) {
      expect(type in materialComponents).toBe(true);
    }
    for (const material of materialGroups.flatMap((group) => group.children)) {
      expect(isOrigamixEditorMaterial(material)).toBe(true);
    }
  });

  it('publishes serializable manifests that agree with editor and runtime registries', () => {
    const paletteByType = new Map(
      materialGroups
        .flatMap((group) => group.children)
        .map((material) => [material.type, material]),
    );

    expect(antdMaterialManifest.formatVersion).toBe('1.0');
    expect(antdMaterialManifest.materialSet).toEqual({
      id: 'official-antd',
      version: '1.0.0',
    });
    expect(antdMaterialManifest.materials).toHaveLength(22);
    expect(() => JSON.stringify(antdMaterialManifest)).not.toThrow();
    expect(JSON.stringify(antdMaterialManifest)).not.toContain('Component');
    expectPureData(antdMaterialManifest);

    for (const manifest of antdMaterialManifest.materials) {
      const paletteMaterial = paletteByType.get(manifest.type);
      expect(paletteMaterial).toBeDefined();
      expect(manifest.type in materialComponents).toBe(true);
      expect(manifest.title).toBe(paletteMaterial?.title);
      expect(manifest.defaultProps).toEqual(paletteMaterial?.defaultProps ?? {});
      expect(manifest.context.variables).toEqual(paletteMaterial?.contextConfig?.variables ?? []);
      expect(manifest.context.values).toEqual(paletteMaterial?.contextConfig?.contextValues ?? []);
      expect(manifest.context.methods).toEqual(paletteMaterial?.contextConfig?.methods ?? []);
      expect(manifest.propsSchema).toMatchObject({
        type: 'object',
        additionalProperties: false,
      });
      expect(antdValidationMaterialRegistry[manifest.type]?.version).toBe(manifest.version);
    }
  });

  it('derives compact agent summaries and supports targeted manifest reads', () => {
    expect(antdAgentMaterialCatalog).toHaveLength(antdMaterialManifest.materials.length);
    expect(antdAgentMaterialCatalog[0]).not.toHaveProperty('propsSchema');
    expect(getAntdMaterialManifests(['table', 'form']).map(({ type }) => type)).toEqual([
      'form',
      'table',
    ]);
    expect(getAntdMaterialManifests(['unknown'])).toEqual([]);
  });

  it('aggregates every manifest from its material-owned definition', () => {
    expect(antdMaterialManifest.materials).toEqual(materialOwnedManifests);
  });
});
