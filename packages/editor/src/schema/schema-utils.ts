import { isPageSchema, type OrigamixPageSchema as Schema, type PageFlow } from '@origamix/shared';

type InsertElement = { id: string; type: string; props?: Record<string, unknown> };
const getParents = (schema: Schema, id: string): string[] => {
  const parents: string[] = [];
  const visited = new Set([id]);
  let current = id;
  while (current !== schema.layout.root) {
    const parent = Object.keys(schema.layout.structure).find((key) =>
      schema.layout.structure[key]?.includes(current),
    );
    if (!parent) break;
    if (visited.has(parent)) throw new Error('页面布局包含循环');
    parents.push(parent);
    visited.add(parent);
    current = parent;
  }
  return parents;
};
const insertAt = (
  schema: Schema,
  parentId: string,
  element: InsertElement,
  index: number,
): Schema => {
  if (!schema.elements[parentId] || Object.hasOwn(schema.elements, element.id))
    throw new Error('无效的插入位置或重复元素');
  const children = [...(schema.layout.structure[parentId] ?? [])];
  children.splice(index, 0, element.id);
  return {
    ...schema,
    elements: {
      ...schema.elements,
      [element.id]: { type: element.type, props: structuredClone(element.props ?? {}) },
    },
    layout: { ...schema.layout, structure: { ...schema.layout.structure, [parentId]: children } },
  };
};
const insertElement = (schema: Schema, parentId: string, element: InsertElement) => {
  const index = schema.layout.structure[parentId]?.length ?? 0;
  return {
    schema: insertAt(schema, parentId, element, index),
    operation: { elementId: element.id, parentId, index, element },
  };
};
const insertAdjacentElement = (
  schema: Schema,
  targetId: string,
  element: InsertElement,
  position: 'before' | 'after' | 'up' | 'down',
) => {
  const parentId = getParents(schema, targetId)[0];
  if (!parentId) throw new Error('根元素不允许同级插入');
  const index =
    schema.layout.structure[parentId]!.indexOf(targetId) +
    (position === 'after' || position === 'down' ? 1 : 0);
  return {
    schema: insertAt(schema, parentId, element, index),
    operation: { elementId: element.id, parentId, index, element },
  };
};
const removeElement = (schema: Schema, id: string) => {
  const parentId = getParents(schema, id)[0];
  if (!parentId || !schema.elements[id]) throw new Error('根元素不能删除');
  const removed = new Set<string>();
  const visit = (key: string) => {
    if (removed.has(key)) return;
    removed.add(key);
    (schema.layout.structure[key] ?? []).forEach(visit);
  };
  visit(id);
  const elements = Object.fromEntries(
    Object.entries(schema.elements).filter(([key]) => !removed.has(key)),
  );
  const structure = Object.fromEntries(
    Object.entries(schema.layout.structure)
      .filter(([key]) => !removed.has(key))
      .map(([key, children]) => [key, children.filter((child) => !removed.has(child))]),
  );
  const bindElements = schema.bindElements.filter((binding) => !removed.has(binding.id));
  const removedFlows = new Set(
    schema.bindElements
      .filter((binding) => removed.has(binding.id))
      .map((binding) => binding.flowId),
  );
  const retainedFlows = new Set(bindElements.map((binding) => binding.flowId));
  const flows = Object.fromEntries(
    Object.entries(schema.flows).filter(
      ([flowId]) => !removedFlows.has(flowId) || retainedFlows.has(flowId),
    ),
  );
  const graphs = schema.extensions.flowGraph as Record<string, unknown> | undefined;
  const extensions = graphs
    ? {
        ...schema.extensions,
        flowGraph: Object.fromEntries(
          Object.entries(graphs).filter(([key]) => !removed.has(key.split('::')[0]!)),
        ),
      }
    : schema.extensions;
  return {
    schema: {
      ...schema,
      elements,
      layout: { ...schema.layout, structure },
      flows,
      bindElements,
      extensions,
    },
    operation: {
      elementId: id,
      parentId,
      index: schema.layout.structure[parentId]!.indexOf(id),
      element: { id, ...schema.elements[id]! },
    },
  };
};
const moveElement = (
  schema: Schema,
  id: string,
  targetId: string,
  options?: { mode?: 'same-level' | 'cross-level'; position?: 'before' | 'after' | 'up' | 'down' },
) => {
  if (id === schema.layout.root || id === targetId || getParents(schema, targetId).includes(id))
    throw new Error('不能移动根元素或放入自身子树');
  const oldParentId = getParents(schema, id)[0];
  const parentId = options?.mode === 'same-level' ? getParents(schema, targetId)[0] : targetId;
  if (!oldParentId || !parentId || !schema.elements[parentId]) throw new Error('无效的移动位置');
  const oldIndex = schema.layout.structure[oldParentId]!.indexOf(id);
  const structure = {
    ...schema.layout.structure,
    [oldParentId]: schema.layout.structure[oldParentId]!.filter((child) => child !== id),
  };
  const children = [...(structure[parentId] ?? [])];
  const index =
    options?.mode === 'same-level'
      ? children.indexOf(targetId) +
        (options.position === 'after' || options.position === 'down' ? 1 : 0)
      : children.length;
  children.splice(index, 0, id);
  structure[parentId] = children;
  return {
    schema: { ...schema, layout: { ...schema.layout, structure } },
    operation: {
      elementId: id,
      oldParentId,
      oldIndex,
      newParentId: parentId,
      newIndex: index,
      mode: options?.mode ?? 'cross-level',
    },
  };
};
const setElementProps = (schema: Schema, id: string, props: Record<string, unknown>) => {
  const element = schema.elements[id];
  if (!element) throw new Error('元素不存在');
  return {
    schema: {
      ...schema,
      elements: { ...schema.elements, [id]: { ...element, props: { ...element.props, ...props } } },
    },
    operation: { elementId: id, props, oldProps: element.props },
  };
};
const normalizeSchema = (candidate: Schema): Schema => {
  if (!isPageSchema(candidate)) throw new Error('页面 Schema 无效');
  return candidate;
};
export const SchemaUtils = {
  getParents,
  insertElement,
  insertAdjacentElement,
  removeElement,
  moveElement,
  setElementProps,
  normalizeSchema,
  getElementById: (schema: Schema, id: string) => ({ id, ...schema.elements[id]! }),
  setEventFlow: (
    schema: Schema,
    id: string,
    event: string,
    flowId: string,
    flow: PageFlow,
  ): Schema => ({
    ...schema,
    flows: { ...schema.flows, [flowId]: flow },
    bindElements: [
      ...schema.bindElements.filter((binding) => binding.id !== id || binding.event !== event),
      { id, event, flowId },
    ],
  }),
  setFlowGraph: (schema: Schema, key: string, graph: unknown): Schema => ({
    ...schema,
    extensions: {
      ...schema.extensions,
      flowGraph: {
        ...(schema.extensions.flowGraph as Record<string, unknown> | undefined),
        [key]: graph,
      },
    },
  }),
};
