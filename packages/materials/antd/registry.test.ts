import { describe, expect, it } from 'vitest';
import materialGroups from './group';
import materialComponents from './index';

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
});
