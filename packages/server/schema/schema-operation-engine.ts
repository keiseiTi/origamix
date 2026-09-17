import type { OrigamixPageSchema, SchemaOperation } from '@origamix/shared/protocol/schema';
import { validatePage, validateSchemaOperation } from '@origamix/shared/protocol/validation';

export type SchemaOperationErrorCode =
  | 'INVALID_OPERATION'
  | 'ELEMENT_NOT_FOUND'
  | 'ELEMENT_ALREADY_EXISTS'
  | 'FLOW_NOT_FOUND'
  | 'FLOW_ALREADY_EXISTS'
  | 'INVALID_PARENT'
  | 'INVALID_INDEX'
  | 'ROOT_OPERATION_DENIED'
  | 'CHILDREN_REQUIRE_EXPLICIT_REMOVAL'
  | 'INVALID_SUBTREE'
  | 'INVALID_RESULT';

export class SchemaOperationError extends Error {
  constructor(
    readonly code: SchemaOperationErrorCode,
    message: string,
    readonly operationIndex: number,
  ) {
    super(message);
    this.name = 'SchemaOperationError';
  }
}

export interface SchemaOperationResult {
  operationIndex: number;
  operation: SchemaOperation['operation'];
  summary: string;
}

export interface SchemaOperationBatchResult {
  schema: OrigamixPageSchema;
  results: SchemaOperationResult[];
}

const fail = (code: SchemaOperationErrorCode, message: string, operationIndex: number): never => {
  throw new SchemaOperationError(code, message, operationIndex);
};

const assertElement = (
  schema: OrigamixPageSchema,
  elementId: string,
  operationIndex: number,
): void => {
  if (!schema.elements[elementId])
    fail('ELEMENT_NOT_FOUND', `元素不存在：${elementId}`, operationIndex);
};

const insertChild = (
  schema: OrigamixPageSchema,
  parentId: string,
  elementId: string,
  index: number | undefined,
  operationIndex: number,
): void => {
  assertElement(schema, parentId, operationIndex);
  const children = schema.layout.structure[parentId] ?? [];
  const targetIndex = index ?? children.length;
  if (targetIndex > children.length)
    fail('INVALID_INDEX', `插入位置超出父元素范围：${targetIndex}`, operationIndex);
  schema.layout.structure[parentId] = [
    ...children.slice(0, targetIndex),
    elementId,
    ...children.slice(targetIndex),
  ];
};

const removeFromParents = (schema: OrigamixPageSchema, elementIds: Set<string>): void => {
  for (const [parentId, children] of Object.entries(schema.layout.structure)) {
    schema.layout.structure[parentId] = children.filter((childId) => !elementIds.has(childId));
  }
};

const collectDescendants = (
  schema: OrigamixPageSchema,
  elementId: string,
  result = new Set<string>(),
): Set<string> => {
  if (result.has(elementId)) return result;
  result.add(elementId);
  for (const childId of schema.layout.structure[elementId] ?? []) {
    collectDescendants(schema, childId, result);
  }
  return result;
};

const bindingReferencesElement = (binding: unknown, elementIds: Set<string>): boolean => {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) return false;
  const record = binding as Record<string, unknown>;
  return (
    (typeof record.id === 'string' && elementIds.has(record.id)) ||
    (typeof record.elementId === 'string' && elementIds.has(record.elementId))
  );
};

const bindingReferencesFlow = (binding: unknown, flowId: string): boolean => {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) return false;
  return (binding as Record<string, unknown>).flowId === flowId;
};

const assertConnectedSubtree = (
  rootElementId: string,
  elementIds: Set<string>,
  structure: Readonly<Record<string, readonly string[]>>,
  operationIndex: number,
): void => {
  const parents = new Map<string, number>();
  for (const [parentId, children] of Object.entries(structure)) {
    if (!elementIds.has(parentId))
      fail('INVALID_SUBTREE', `子树布局包含未知父元素：${parentId}`, operationIndex);
    for (const childId of children) {
      if (!elementIds.has(childId))
        fail('INVALID_SUBTREE', `子树布局包含外部元素：${childId}`, operationIndex);
      parents.set(childId, (parents.get(childId) ?? 0) + 1);
    }
  }
  if (parents.has(rootElementId))
    fail('INVALID_SUBTREE', '子树根元素不能作为子节点', operationIndex);
  for (const elementId of elementIds) {
    if (elementId === rootElementId) continue;
    if (parents.get(elementId) !== 1)
      fail('INVALID_SUBTREE', `子树元素必须且只能有一个父元素：${elementId}`, operationIndex);
  }
  const reachable = new Set<string>();
  const visit = (elementId: string): void => {
    if (reachable.has(elementId)) return;
    reachable.add(elementId);
    for (const childId of structure[elementId] ?? []) visit(childId);
  };
  visit(rootElementId);
  if (reachable.size !== elementIds.size)
    fail('INVALID_SUBTREE', '子树包含无法从根元素到达的节点', operationIndex);
};

const executeOperation = (
  schema: OrigamixPageSchema,
  operation: SchemaOperation,
  operationIndex: number,
): string => {
  if (operation.operation === 'addElement') {
    if (schema.elements[operation.elementId])
      fail('ELEMENT_ALREADY_EXISTS', `元素已经存在：${operation.elementId}`, operationIndex);
    schema.elements[operation.elementId] = structuredClone(operation.element);
    schema.layout.structure[operation.elementId] = [];
    insertChild(schema, operation.parentId, operation.elementId, operation.index, operationIndex);
    return `新增元素 ${operation.elementId}`;
  }

  if (operation.operation === 'insertSubtree') {
    if (!operation.elements[operation.rootElementId])
      fail('INVALID_SUBTREE', '子树根元素不在 elements 中', operationIndex);
    const subtreeIds = new Set(Object.keys(operation.elements));
    if (subtreeIds.size === 0) fail('INVALID_SUBTREE', '子树不能为空', operationIndex);
    for (const elementId of subtreeIds) {
      if (schema.elements[elementId])
        fail('ELEMENT_ALREADY_EXISTS', `元素已经存在：${elementId}`, operationIndex);
    }
    assertConnectedSubtree(
      operation.rootElementId,
      subtreeIds,
      operation.structure,
      operationIndex,
    );
    for (const elementId of subtreeIds) {
      schema.elements[elementId] = structuredClone(operation.elements[elementId]!);
      schema.layout.structure[elementId] = [...(operation.structure[elementId] ?? [])];
    }
    insertChild(
      schema,
      operation.parentId,
      operation.rootElementId,
      operation.index,
      operationIndex,
    );
    return `插入组件树 ${operation.rootElementId}`;
  }

  if (operation.operation === 'removeElement') {
    assertElement(schema, operation.elementId, operationIndex);
    if (operation.elementId === schema.layout.root)
      fail('ROOT_OPERATION_DENIED', '不能删除页面根元素', operationIndex);
    const children = schema.layout.structure[operation.elementId] ?? [];
    if (children.length > 0 && operation.removeDescendants !== true) {
      fail(
        'CHILDREN_REQUIRE_EXPLICIT_REMOVAL',
        '目标元素包含子元素，必须明确允许删除整个子树',
        operationIndex,
      );
    }
    const removed = operation.removeDescendants
      ? collectDescendants(schema, operation.elementId)
      : new Set([operation.elementId]);
    removeFromParents(schema, removed);
    for (const elementId of removed) {
      delete schema.elements[elementId];
      delete schema.layout.structure[elementId];
    }
    schema.bindElements = schema.bindElements.filter(
      (binding) => !bindingReferencesElement(binding, removed),
    );
    return `删除元素 ${operation.elementId}`;
  }

  if (operation.operation === 'moveElement') {
    assertElement(schema, operation.elementId, operationIndex);
    if (operation.elementId === schema.layout.root)
      fail('ROOT_OPERATION_DENIED', '不能移动页面根元素', operationIndex);
    assertElement(schema, operation.parentId, operationIndex);
    if (collectDescendants(schema, operation.elementId).has(operation.parentId))
      fail('INVALID_PARENT', '不能把元素移动到自身或其后代中', operationIndex);
    removeFromParents(schema, new Set([operation.elementId]));
    insertChild(schema, operation.parentId, operation.elementId, operation.index, operationIndex);
    return `移动元素 ${operation.elementId}`;
  }

  if (operation.operation === 'updateElementProps') {
    assertElement(schema, operation.elementId, operationIndex);
    if (!operation.set && !operation.unset?.length)
      fail('INVALID_OPERATION', '属性更新必须包含 set 或 unset', operationIndex);
    const element = schema.elements[operation.elementId]!;
    const props = { ...element.props, ...(operation.set ?? {}) };
    for (const field of operation.unset ?? []) delete props[field];
    schema.elements[operation.elementId] = { ...element, props };
    return `更新元素属性 ${operation.elementId}`;
  }

  if (operation.operation === 'replaceElement') {
    assertElement(schema, operation.elementId, operationIndex);
    schema.elements[operation.elementId] = structuredClone(operation.element);
    return `替换元素定义 ${operation.elementId}`;
  }

  if (operation.operation === 'addFlow') {
    if (Object.hasOwn(schema.flows, operation.flowId))
      fail('FLOW_ALREADY_EXISTS', `流程已经存在：${operation.flowId}`, operationIndex);
    schema.flows[operation.flowId] = structuredClone(operation.flow);
    return `新增流程 ${operation.flowId}`;
  }

  if (operation.operation === 'updateFlow') {
    if (!Object.hasOwn(schema.flows, operation.flowId))
      fail('FLOW_NOT_FOUND', `流程不存在：${operation.flowId}`, operationIndex);
    schema.flows[operation.flowId] = structuredClone(operation.flow);
    return `更新流程 ${operation.flowId}`;
  }

  if (operation.operation === 'removeFlow') {
    if (!Object.hasOwn(schema.flows, operation.flowId))
      fail('FLOW_NOT_FOUND', `流程不存在：${operation.flowId}`, operationIndex);
    delete schema.flows[operation.flowId];
    schema.bindElements = schema.bindElements.filter(
      (binding) => !bindingReferencesFlow(binding, operation.flowId),
    );
    return `删除流程 ${operation.flowId}`;
  }

  if (operation.operation === 'setElementBindings') {
    schema.bindElements = structuredClone(operation.bindings);
    return '更新元素绑定';
  }

  schema.context.globalVariables = structuredClone(operation.globalVariables);
  return '更新页面上下文';
};

export const applySchemaOperationBatch = (
  source: OrigamixPageSchema,
  operations: readonly SchemaOperation[],
): SchemaOperationBatchResult => {
  if (operations.length === 0) fail('INVALID_OPERATION', 'Operation Batch 不能为空', 0);
  const schema = structuredClone(source);
  const results: SchemaOperationResult[] = [];
  for (const [operationIndex, operation] of operations.entries()) {
    const validation = validateSchemaOperation(operation);
    if (!validation.valid) fail('INVALID_OPERATION', 'Schema Operation 格式无效', operationIndex);
    results.push({
      operationIndex,
      operation: operation.operation,
      summary: executeOperation(schema, operation, operationIndex),
    });
  }
  const validation = validatePage(schema);
  if (!validation.valid) {
    const message =
      validation.semanticErrors[0]?.message ??
      validation.errors[0]?.message ??
      '批量操作生成了无效页面';
    fail('INVALID_RESULT', message, Math.max(0, operations.length - 1));
  }
  return { schema, results };
};
