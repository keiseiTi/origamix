import { equalJson } from '@origamix/shared';
import type { OrigamixPageSchema, WorkingSchemaOperation } from '@origamix/shared';

const changes = <T>(before: Record<string, T>, after: Record<string, T>) => ({
  set: Object.fromEntries(
    Object.entries(after).filter(([id, value]) => !equalJson(before[id], value)),
  ),
  remove: Object.keys(before).filter((id) => !Object.hasOwn(after, id)),
});

export const deriveSchemaOperations = (
  before: OrigamixPageSchema,
  after: OrigamixPageSchema,
): WorkingSchemaOperation[] => {
  const operations: WorkingSchemaOperation[] = [];
  const elements = changes(before.elements, after.elements);
  const updatedIds = Object.keys(elements.set);
  const layoutChanged = !equalJson(before.layout, after.layout);
  const [onlyId] = updatedIds;
  const oldElement = onlyId ? before.elements[onlyId] : undefined;
  const newElement = onlyId ? elements.set[onlyId] : undefined;

  if (
    !layoutChanged &&
    !elements.remove.length &&
    updatedIds.length === 1 &&
    onlyId &&
    oldElement &&
    newElement &&
    oldElement.type === newElement.type
  ) {
    const props = changes(oldElement.props, newElement.props);
    operations.push({
      operation: 'updateElementProps',
      elementId: onlyId,
      ...(Object.keys(props.set).length ? { set: props.set } : {}),
      ...(props.remove.length ? { unset: props.remove } : {}),
    });
  } else if (layoutChanged || elements.remove.length || updatedIds.length) {
    operations.push({ operation: 'reconcileElementTree', layout: after.layout, ...elements });
  }

  const flows = changes(before.flows, after.flows);
  if (flows.remove.length || Object.keys(flows.set).length)
    operations.push({ operation: 'reconcileFlows', ...flows });
  if (!equalJson(before.bindElements, after.bindElements))
    operations.push({ operation: 'setElementBindings', bindings: after.bindElements });
  if (!equalJson(before.context.globalVariables, after.context.globalVariables))
    operations.push({
      operation: 'updatePageContext',
      globalVariables: after.context.globalVariables,
    });
  if (!equalJson(before.extensions.flowGraph, after.extensions.flowGraph))
    operations.push({ operation: 'setFlowGraph', graph: after.extensions.flowGraph ?? null });
  return operations;
};
