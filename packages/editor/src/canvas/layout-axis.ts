import { getMaterialDisplay, type OrigamixPageSchema } from '@origamix/shared';
import type { Material } from '../contracts/material-contracts';
import { SchemaUtils } from '../schema/schema-utils';

/** Parent layout owns ordering; flow falls back to each item's declared occupancy. */
export const getInsertionAxis = (
  schema: OrigamixPageSchema,
  materials: Material[],
  targetId: string,
  canvasRoot: HTMLElement | null,
  dragged?: { material: Material; props: Record<string, unknown> },
): 'horizontal' | 'vertical' => {
  const parentId = SchemaUtils.getParents(schema, targetId)[0];
  const parent = parentId ? schema.elements[parentId] : undefined;
  if (parentId) {
    const frame = canvasRoot?.querySelector(`[data-element-id="${CSS.escape(parentId)}"]`);
    const content = frame?.firstElementChild;
    const style = content ? getComputedStyle(content) : undefined;
    if (style?.display === 'flex' || style?.display === 'inline-flex')
      return style.flexDirection.startsWith('row') ? 'horizontal' : 'vertical';
    if (parent?.props.display === 'flex')
      return parent.props.flexDirection === 'row' ? 'horizontal' : 'vertical';
  }
  const element = schema.elements[targetId];
  const material = materials.find((item) => item.type === element?.type);
  return getMaterialDisplay(material?.layout, element?.props ?? {}) === 'block' ||
    (dragged && getMaterialDisplay(dragged.material.layout, dragged.props) === 'block')
    ? 'vertical'
    : 'horizontal';
};
