import { materialGroups } from '../../antd/editor';
import { describe, expect, it } from 'vitest';
import materialComponents, { materialSet } from '../../antd/runtime';
import { antdMaterialManifest, antdValidationMaterialRegistry } from '../../antd/manifest';

describe('material boundary used by editing and preview', () => {
  it('publishes serializable materials that validation and rendering both recognize', () => {
    expect(() => structuredClone(antdMaterialManifest)).not.toThrow();
    expect(() => JSON.stringify(antdMaterialManifest)).not.toThrow();
    for (const material of materialGroups.flatMap((group) => group.children)) {
      expect(antdValidationMaterialRegistry[material.type]).toBeDefined();
      expect(material.type in materialComponents).toBe(true);
      const manifest = antdMaterialManifest.materials.find((item) => item.type === material.type)!;
      expect(material.acceptsChildren).toBe(manifest.acceptsChildren);
      expect(material.layout).toEqual(manifest.layout);
      expect((material.Component as { origamixLayout?: unknown }).origamixLayout).toEqual(
        manifest.layout,
      );
      expect(materialComponents[material.type]?.origamixLayout).toEqual(manifest.layout);
    }
    expect(materialSet).toEqual({ id: 'official-antd', version: '1.0.0' });
    expect(antdMaterialManifest.materialSet).toEqual(materialSet);
    for (const material of antdMaterialManifest.materials) {
      expect(material.version).toBe(materialSet.version);
      expect(material.type in materialComponents).toBe(true);
      expect(material.propsSchema.additionalProperties).toBe(false);
      expect(material.propsSchema.properties).toMatchObject({ alias: { type: 'string' } });
      expect(material.propsSchema.required ?? []).not.toContain('alias');
      expect(material.context.methods.filter((method) => method.name === 'init')).toHaveLength(1);
      expect(antdValidationMaterialRegistry[material.type]?.version).toBe(material.version);
    }
  });
});
