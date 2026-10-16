import type { OrigamixPageSchema, SchemaOperation } from '@origamix/shared/protocol/schema';

const same = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const parentMap = (schema: OrigamixPageSchema): Map<string, string> => {
  const result = new Map<string, string>();
  for (const [parentId, children] of Object.entries(schema.layout.structure))
    for (const childId of children) result.set(childId, parentId);
  return result;
};

const depthOf = (elementId: string, parents: Map<string, string>): number => {
  let depth = 0;
  let current = elementId;
  const visited = new Set<string>();
  while (parents.has(current) && !visited.has(current)) {
    visited.add(current);
    current = parents.get(current)!;
    depth += 1;
  }
  return depth;
};

/**
 * Converts a Tangramino snapshot into deterministic domain operations.
 * Returns null when the change cannot be represented safely by the current
 * operation protocol, allowing the editor-only snapshot endpoint to be used.
 */
export const deriveSchemaOperations = (
  before: OrigamixPageSchema,
  after: OrigamixPageSchema,
): SchemaOperation[] | null => {
  if (before.layout.root !== after.layout.root || !same(before.extensions, after.extensions))
    return null;

  const operations: SchemaOperation[] = [];
  const beforeIds = new Set(Object.keys(before.elements));
  const afterIds = new Set(Object.keys(after.elements));
  const beforeParents = parentMap(before);
  const afterParents = parentMap(after);
  const removedIds = [...beforeIds].filter((id) => !afterIds.has(id));

  // Removing an ancestor while retaining one of its descendants would require
  // reparenting before deletion. Keep that uncommon transformation on the
  // validated editor-only snapshot fallback instead of guessing an order.
  for (const removedId of removedIds) {
    const stack = [...(before.layout.structure[removedId] ?? [])];
    while (stack.length > 0) {
      const descendant = stack.pop()!;
      if (afterIds.has(descendant)) return null;
      stack.push(...(before.layout.structure[descendant] ?? []));
    }
  }

  const removedSet = new Set(removedIds);
  for (const elementId of removedIds.filter((id) => !removedSet.has(beforeParents.get(id) ?? '')))
    operations.push({ operation: 'removeElement', elementId, removeDescendants: true });

  const addedIds = [...afterIds]
    .filter((id) => !beforeIds.has(id))
    .sort((left, right) => depthOf(left, afterParents) - depthOf(right, afterParents));
  for (const elementId of addedIds) {
    if (elementId === after.layout.root) return null;
    const parentId = afterParents.get(elementId);
    const element = after.elements[elementId];
    if (!parentId || !element) return null;
    operations.push({
      operation: 'addElement',
      elementId,
      element,
      parentId,
      index: after.layout.structure[parentId]?.indexOf(elementId),
    });
  }

  for (const elementId of [...beforeIds].filter((id) => afterIds.has(id))) {
    const beforeElement = before.elements[elementId]!;
    const afterElement = after.elements[elementId]!;
    if (beforeElement.type !== afterElement.type) {
      operations.push({ operation: 'replaceElement', elementId, element: afterElement });
      continue;
    }
    const set = Object.fromEntries(
      Object.entries(afterElement.props).filter(
        ([key, value]) => !same(beforeElement.props[key], value),
      ),
    );
    const unset = Object.keys(beforeElement.props).filter((key) => !(key in afterElement.props));
    if (Object.keys(set).length > 0 || unset.length > 0)
      operations.push({
        operation: 'updateElementProps',
        elementId,
        ...(Object.keys(set).length > 0 ? { set } : {}),
        ...(unset.length > 0 ? { unset } : {}),
      });
  }

  for (const [parentId, children] of Object.entries(after.layout.structure)) {
    for (const [index, elementId] of children.entries()) {
      if (elementId === after.layout.root || !after.elements[elementId]) return null;
      if (
        !addedIds.includes(elementId) &&
        beforeParents.get(elementId) === parentId &&
        before.layout.structure[parentId]?.indexOf(elementId) === index
      )
        continue;
      operations.push({ operation: 'moveElement', elementId, parentId, index });
    }
  }

  for (const flowId of Object.keys(before.flows).filter((id) => !(id in after.flows)))
    operations.push({ operation: 'removeFlow', flowId });
  for (const [flowId, flow] of Object.entries(after.flows)) {
    if (!(flowId in before.flows)) operations.push({ operation: 'addFlow', flowId, flow });
    else if (!same(before.flows[flowId], flow))
      operations.push({ operation: 'updateFlow', flowId, flow });
  }
  if (!same(before.bindElements, after.bindElements))
    operations.push({ operation: 'setElementBindings', bindings: after.bindElements });
  if (!same(before.context.globalVariables, after.context.globalVariables))
    operations.push({
      operation: 'updatePageContext',
      globalVariables: after.context.globalVariables,
    });

  return operations;
};
