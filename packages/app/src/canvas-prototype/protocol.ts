import type { CanvasPrototypeCommand, CanvasPrototypeSnapshot } from '@origamix/editor';
import type { OrigamixPageSchema } from '@origamix/shared';
export interface Scope {
  protocol: 1;
  instanceId: string;
  projectId: 'prototype';
  pageId: 'sample';
}
export type Request = Scope & {
  commandId: number;
  version: number;
  command: CanvasPrototypeCommand;
};
export type Reply = Scope &
  (
    | { kind: 'snapshot'; commandId: number; version: number; snapshot: CanvasPrototypeSnapshot }
    | { kind: 'error'; commandId: number; message: string }
  );
export const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key));
const integer = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;
const text = (value: unknown): value is string => typeof value === 'string' && value.length <= 1000;
const point = (value: Record<string, unknown>) =>
  typeof value.x === 'number' &&
  typeof value.y === 'number' &&
  Number.isFinite(value.x) &&
  Number.isFinite(value.y) &&
  Math.abs(value.x) < 10000 &&
  Math.abs(value.y) < 10000;
export const sameScope = (value: unknown, scope: Scope): value is Scope & Record<string, unknown> =>
  record(value) &&
  value.protocol === 1 &&
  value.instanceId === scope.instanceId &&
  value.projectId === scope.projectId &&
  value.pageId === scope.pageId;
export const isCommand = (value: unknown): value is CanvasPrototypeCommand => {
  if (!record(value)) return false;
  switch (value.kind) {
    case 'select':
      return exact(value, ['kind', 'id']) && text(value.id);
    case 'update':
      return (
        exact(value, ['kind', 'id', 'field', 'value']) &&
        text(value.id) &&
        ['text', 'placeholder'].includes(String(value.field)) &&
        text(value.value)
      );
    case 'add':
      return (
        exact(value, ['kind', 'materialType', 'x', 'y']) &&
        ['button', 'input'].includes(String(value.materialType)) &&
        point(value)
      );
    case 'hover':
      return exact(value, ['kind', 'x', 'y']) && point(value);
    case 'undo':
    case 'redo':
    case 'snapshot':
    case 'cancel':
      return exact(value, ['kind']);
    default:
      return false;
  }
};
export const isRequest = (value: unknown, scope: Scope): value is Request =>
  sameScope(value, scope) &&
  exact(value, [
    'protocol',
    'instanceId',
    'projectId',
    'pageId',
    'commandId',
    'version',
    'command',
  ]) &&
  integer(value.commandId) &&
  integer(value.version) &&
  isCommand(value.command);
export const isPrototypeSchema = (value: unknown): value is OrigamixPageSchema => {
  if (
    !record(value) ||
    !record(value.elements) ||
    Object.keys(value.elements).length > 100 ||
    !record(value.layout) ||
    !record(value.layout.structure) ||
    !record(value.context) ||
    !record(value.flows) ||
    !Array.isArray(value.bindElements)
  )
    return false;
  if (
    Object.keys(value.flows).length ||
    value.bindElements.length ||
    !Array.isArray(value.context.globalVariables) ||
    value.context.globalVariables.length
  )
    return false;
  return Object.entries(value.elements).every(
    ([id, element]) =>
      !['__proto__', 'prototype', 'constructor'].includes(id) &&
      record(element) &&
      ['container', 'form', 'button', 'input'].includes(String(element.type)) &&
      record(element.props) &&
      JSON.stringify(element.props).length <= 10000,
  );
};
export const isReply = (value: unknown, scope: Scope): value is Reply => {
  if (!sameScope(value, scope) || !integer(value.commandId)) return false;
  if (value.kind === 'error')
    return (
      exact(value, [
        'protocol',
        'instanceId',
        'projectId',
        'pageId',
        'kind',
        'commandId',
        'message',
      ]) && text(value.message)
    );
  if (
    value.kind !== 'snapshot' ||
    !exact(value, [
      'protocol',
      'instanceId',
      'projectId',
      'pageId',
      'kind',
      'commandId',
      'version',
      'snapshot',
    ]) ||
    !integer(value.version) ||
    !record(value.snapshot)
  )
    return false;
  const snapshot = value.snapshot;
  return (
    exact(snapshot, ['schema', 'selectedId', 'canUndo', 'canRedo']) &&
    isPrototypeSchema(snapshot.schema) &&
    (snapshot.selectedId === null ||
      (text(snapshot.selectedId) &&
        Object.hasOwn(snapshot.schema.elements, snapshot.selectedId))) &&
    typeof snapshot.canUndo === 'boolean' &&
    typeof snapshot.canRedo === 'boolean'
  );
};
