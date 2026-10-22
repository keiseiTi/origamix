import { Component, createRef, type ReactNode, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  CanvasPrototypeSurface,
  type CanvasPrototypeHandle,
  type CanvasPrototypeSnapshot,
} from '@origamix/editor';
import { materialGroups, antdMaterialManifest } from '@origamix/materials/antd/editor';
import {
  isRequest,
  isPrototypeSchema,
  sameScope,
  record,
  type Scope,
  type Reply,
} from './protocol';
import './frame.css';
const registration = {
  catalog: antdMaterialManifest,
  groups: materialGroups.map((group) => ({
    ...group,
    children: group.children.filter((item) =>
      ['container', 'form', 'button', 'input'].includes(item.type),
    ),
  })),
  propertyEditors: [],
};
let channel: MessagePort | null = null;
let scope: Scope | null = null;
let version = 0;
let lastSchema = '';
let lastCommand = 0;
let responding = 0;
const handle = createRef<CanvasPrototypeHandle>();
const send = (
  message:
    | Omit<Extract<Reply, { kind: 'snapshot' }>, keyof Scope>
    | Omit<Extract<Reply, { kind: 'error' }>, keyof Scope>,
) => {
  if (scope) channel?.postMessage({ ...scope, ...message });
};
const publish = (snapshot: CanvasPrototypeSnapshot) => {
  const serialized = JSON.stringify(snapshot.schema);
  if (lastSchema && serialized !== lastSchema) version++;
  lastSchema = serialized;
  send({ kind: 'snapshot', commandId: responding, version, snapshot });
};
class FrameBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    send({ kind: 'error', commandId: responding, message: error.message.slice(0, 500) });
  }
  render() {
    return this.state.failed ? (
      <p role='alert'>画布渲染失败，请从宿主恢复。</p>
    ) : (
      this.props.children
    );
  }
}
export const Frame = ({
  schema,
}: {
  schema: Parameters<typeof CanvasPrototypeSurface>[0]['schema'];
}) => {
  const change = useCallback((snapshot: CanvasPrototypeSnapshot) => publish(snapshot), []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        event.isComposing ||
        (event.target as HTMLElement).closest('input,textarea,[contenteditable="true"]')
      )
        return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        publish(handle.current!.run({ kind: event.shiftKey ? 'redo' : 'undo' }));
      }
      if (event.key === 'Escape') {
        handle.current?.run({ kind: 'cancel' });
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);
  return (
    <CanvasPrototypeSurface
      ref={handle}
      schema={schema}
      registration={registration}
      onSnapshot={change}
    />
  );
};
window.addEventListener(
  'message',
  (event: MessageEvent) => {
    if (
      channel ||
      event.source !== parent ||
      !record(event.data) ||
      event.data.kind !== 'prototype.initialize' ||
      !record(event.data.scope) ||
      !isPrototypeSchema(event.data.schema) ||
      event.ports.length !== 1
    )
      return;
    const candidate = event.data.scope as unknown as Scope;
    if (
      candidate.protocol !== 1 ||
      candidate.projectId !== 'prototype' ||
      candidate.pageId !== 'sample' ||
      typeof candidate.instanceId !== 'string'
    )
      return;
    scope = candidate;
    channel = event.ports[0]!;
    channel.onmessage = (incoming: MessageEvent<unknown>) => {
      if (!scope || !sameScope(incoming.data, scope) || !isRequest(incoming.data, scope)) return;
      const request = incoming.data;
      if (request.commandId <= lastCommand) return;
      lastCommand = request.commandId;
      responding = request.commandId;
      try {
        if (
          request.version !== version &&
          !['hover', 'cancel', 'select', 'snapshot'].includes(request.command.kind)
        )
          throw new Error('画布版本已变化，请重试当前操作');
        if (!handle.current) throw new Error('画布尚未就绪');
        const snapshot = handle.current.run(request.command);
        if (!['hover', 'cancel'].includes(request.command.kind)) publish(snapshot);
      } catch (error) {
        send({
          kind: 'error',
          commandId: request.commandId,
          message: error instanceof Error ? error.message.slice(0, 500) : '操作失败',
        });
      }
    };
    channel.start();
    createRoot(document.getElementById('root')!).render(
      <FrameBoundary>
        <Frame schema={event.data.schema} />
      </FrameBoundary>,
    );
  },
  { once: false },
);
