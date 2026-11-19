import { SCHEMA_VERSION } from '@origamix/shared';
import type { RuntimeSchema, LayoutNode } from './types';

export const parseLayout = (schema: RuntimeSchema): LayoutNode[] => {
  const metadata = schema.extensions?.origamix;
  if (
    !metadata ||
    typeof metadata !== 'object' ||
    !('schemaVersion' in metadata) ||
    metadata.schemaVersion !== SCHEMA_VERSION
  )
    throw new Error(`页面 Schema 版本不受支持，当前版本为 ${SCHEMA_VERSION}`);
  const visited = new Set<string>();
  const visit = (id: string): LayoutNode => {
    if (!Object.hasOwn(schema.elements, id) || visited.has(id))
      throw new Error(`无效的页面布局：${id}`);
    visited.add(id);
    return { id, children: (schema.layout.structure[id] ?? []).map(visit) };
  };
  return [visit(schema.layout.root)];
};
