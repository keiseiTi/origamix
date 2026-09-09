import { describe, expect, it } from 'vitest';
import materialGroups from './group';
import materialComponents from './index';
import {
  antdAgentMaterialCatalog,
  antdMaterialManifest,
  antdValidationMaterialRegistry,
  getAntdMaterialManifests,
} from './manifest';
import { containerManifest } from './container/manifest';
import { formManifest } from './form/manifest';
import { inputManifest } from './input/manifest';

function expectPureData(value: unknown): void {
  expect(typeof value).not.toBe('function');
  if (Array.isArray(value)) {
    value.forEach(expectPureData);
    return;
  }
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(expectPureData);
  }
}

describe('antd material registry', () => {
  it('keeps palette material types unique and registered at runtime', () => {
    const types = materialGroups.flatMap((group) =>
      group.children.map((material) => material.type),
    );

    expect(new Set(types).size).toBe(types.length);
    for (const type of types) {
      expect(type in materialComponents).toBe(true);
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

  it('aggregates core manifests from their material-owned definitions', () => {
    expect(antdMaterialManifest.materials).toEqual(
      expect.arrayContaining([containerManifest, formManifest, inputManifest]),
    );
  });
});
