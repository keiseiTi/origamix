import { describe, expect, it } from 'vitest';
import materialComponents from '../../antd/index';
import { antdMaterialManifest, antdValidationMaterialRegistry } from '../../antd/manifest';

describe('material boundary used by editing and preview', () => {
  it('publishes serializable materials that validation and rendering both recognize', () => {
    expect(() => structuredClone(antdMaterialManifest)).not.toThrow();
    expect(() => JSON.stringify(antdMaterialManifest)).not.toThrow();
    for (const material of antdMaterialManifest.materials) {
      expect(material.type in materialComponents).toBe(true);
      expect(antdValidationMaterialRegistry[material.type]?.version).toBe(material.version);
    }
  });
});
