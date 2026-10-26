import type { RuntimeSchema, LayoutNode } from './types';

export const parseLayout = (schema: RuntimeSchema): LayoutNode[] => {
  const visited = new Set<string>();
  const visit = (id: string): LayoutNode => {
    if (!Object.hasOwn(schema.elements, id) || visited.has(id))
      throw new Error(`无效的页面布局：${id}`);
    visited.add(id);
    return { id, children: (schema.layout.structure[id] ?? []).map(visit) };
  };
  return [visit(schema.layout.root)];
};
