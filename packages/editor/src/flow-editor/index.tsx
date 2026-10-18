import { getElementLabel } from '@origamix/shared';
import LogicFlow from '@logicflow/core';
import { SelectionSelect } from '@logicflow/extension';
import '@logicflow/core/lib/style/index.css';
import '@logicflow/extension/lib/style/index.css';
import { useEffect, useRef, useState } from 'react';
import { useFlowEditorSession } from './session';
import { SchemaUtils } from '@tangramino/engine';
import { Maximize, Minus, Plus, Undo2, Redo2 } from 'lucide-react';
import { Button } from '@origamix/ui';
import { nodeKinds, readGraph, toFlow, type EventTarget } from './model';
import { createReactNode } from './react-node';
import './style.css';
import { EventTree } from './event-tree';
import { defaultNodeProps, getNodeDefinition } from './nodes/definitions';
import { NodeProperties } from './nodes/node-properties';

export const FlowEditor = ({
  target,
  onTargetChange,
}: {
  target: EventTarget | null;
  onTargetChange: (target: EventTarget) => void;
}): React.JSX.Element => {
  const { schema, materials, onChange } = useFlowEditorSession();
  const container = useRef<HTMLDivElement>(null);
  const lfRef = useRef<LogicFlow | null>(null);
  const lastGraph = useRef('');
  const [selected, setSelected] = useState<LogicFlow.NodeData | null>(null);
  const [historyState, setHistoryState] = useState({ undoAble: false, redoAble: false });
  const [error, setError] = useState<string | null>(null);
  const schemaRef = useRef(schema);
  useEffect(() => {
    schemaRef.current = schema;
  }, [schema]);
  const commit = (): void => {
    const schema = schemaRef.current;
    const lf = lfRef.current;
    if (!lf || !target) return;
    const graph = lf.getGraphRawData();
    if (JSON.stringify(graph) === lastGraph.current) return;
    try {
      const flow = toFlow(graph);
      const binding = schema.bindElements?.find(
        (item) => item.id === target.elementId && item.event === target.event,
      );
      const next = SchemaUtils.setEventFlow(
        schema,
        target.elementId,
        target.event,
        binding?.flowId ?? `flow-${crypto.randomUUID()}`,
        flow,
      );
      lastGraph.current = JSON.stringify(graph);
      const candidate = SchemaUtils.setFlowGraph(
        next,
        `${target.elementId}::${target.event}`,
        graph,
      );
      schemaRef.current = candidate;
      onChange(candidate);
      setError(null);
    } catch (reason) {
      lf.render(JSON.parse(lastGraph.current) as LogicFlow.GraphData);
      setError(reason instanceof Error ? reason.message : '流程更新失败');
    }
  };
  const initialGraph = useRef(target ? readGraph(schema, target) : null);
  useEffect(() => {
    if (!container.current || !initialGraph.current) return;
    const lf = new LogicFlow({
      container: container.current,
      grid: { size: 20, type: 'dot', config: { color: '#a1a1aa', thickness: 1 } },
      background: { backgroundColor: 'transparent' },
      plugins: [SelectionSelect],
      keyboard: { enabled: true },
      guards: { beforeDelete: (data) => data.type !== 'start' },
      history: true,
      edgeTextEdit: false,
      nodeTextEdit: false,
      adjustEdge: false,
    });
    lfRef.current = lf;
    const reactNode = createReactNode((id) =>
      getElementLabel(
        id,
        schemaRef.current.elements[id],
        String(
          materials.find((material) => material.type === schemaRef.current.elements[id]?.type)
            ?.title ??
            schemaRef.current.elements[id]?.type ??
            id,
        ),
      ),
    );
    lf.register({ type: 'start', ...reactNode });
    nodeKinds.forEach((kind) => lf.register({ type: kind.type, ...reactNode }));
    lf.setTheme({
      polyline: { stroke: '#71717a', strokeWidth: 2 },
      anchor: { fill: '#ffffff', stroke: '#6366f1', r: 5 },
    });
    lf.render(initialGraph.current);
    lastGraph.current = JSON.stringify(lf.getGraphRawData());
    // LogicFlow may emit several events inside one model mutation (e.g. deleting
    // a node also deletes edges). Read the completed graph after that mutation.
    let scheduled = false;
    let active = true;
    const scheduleCommit = (): void => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        if (!active) return;
        scheduled = false;
        commit();
      });
    };
    // Canvas-scoped shortcuts must commit through the same Working pipeline.
    // Keep the previously unavailable clipboard shortcuts disabled.
    lf.keyboard.off(['cmd+c', 'ctrl+c', 'cmd+v', 'ctrl+v']);
    lf.keyboard.on(['delete', 'backspace'], () => {
      const elements = lf.getSelectElements(true);
      elements.edges.forEach((edge) => lf.deleteEdge(edge.id));
      elements.nodes.forEach((node) => lf.deleteNode(node.id));
      setSelected(null);
      lf.container.focus();
      return false;
    });
    lf.keyboard.on(['cmd+z', 'ctrl+z'], () => {
      lf.undo();
      commit();
      setSelected(null);
      lf.container.focus();
      return false;
    });
    lf.keyboard.on(['cmd+y', 'ctrl+y', 'cmd+shift+z', 'ctrl+shift+z'], () => {
      lf.redo();
      commit();
      setSelected(null);
      lf.container.focus();
      return false;
    });
    const selectAddedNode = ({ data }: { data: LogicFlow.NodeData }): void => {
      lf.selectElementById(data.id);
      setSelected(data);
      lf.container.focus();
    };
    lf.on('node:add,node:dnd-add', selectAddedNode);
    lf.on('node:delete', ({ data }) =>
      setSelected((current) => (current?.id === data.id ? null : current)),
    );
    lf.on('node:click', ({ data }) => setSelected(data));
    lf.on('blank:click', () => setSelected(null));
    lf.on('history:change', ({ data }) =>
      setHistoryState({ undoAble: data.undoAble, redoAble: data.redoAble }),
    );
    lf.on(
      'node:add,node:dnd-add,node:delete,node:drop,node:properties-change,edge:add,edge:delete,edge:adjust,edge:exchange-node',
      scheduleCommit,
    );
    lf.setDefaultEdgeType('polyline');
    const observer = new ResizeObserver(() => lf.resize());
    observer.observe(container.current);
    return () => {
      if (scheduled) commit();
      active = false;
      observer.disconnect();
      lfRef.current = null;
      lf.destroy();
    };
    // The event target owns one mounted canvas; schema changes are reconciled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const lf = lfRef.current;
    if (!lf || !target) return;
    const graph = readGraph(schema, target);
    if (JSON.stringify(graph) === lastGraph.current) return;
    lf.render(graph);
    lastGraph.current = JSON.stringify(lf.getGraphRawData());
    setSelected((current) => (current ? (lf.getNodeDataById(current.id) ?? null) : null));
  }, [schema, target]);

  const update = (patch: Record<string, unknown>): void => {
    if (!selected) return;
    const lf = lfRef.current!;
    lf.setProperties(selected.id, patch);
    setSelected(lf.getNodeDataById(selected.id) ?? null);
  };
  const addWithKeyboard = (type: string): void => {
    const lf = lfRef.current;
    if (!lf || !container.current) return;
    const bounds = container.current.getBoundingClientRect();
    const { canvasOverlayPosition } = lf.getPointByClient(
      bounds.left + bounds.width / 2,
      bounds.top + bounds.height / 2,
    );
    lf.addNode({ type, ...canvasOverlayPosition, properties: defaultNodeProps(type) });
  };
  return (
    <section
      className='flex min-h-0 flex-1 flex-col bg-white text-foreground dark:bg-zinc-950'
      aria-label='逻辑编辑器'
    >
      {error && (
        <div role='alert' className='border-b bg-destructive/10 px-4 py-2 text-sm text-destructive'>
          {error}，已保留上一次有效流程。
        </div>
      )}
      <div className='flex min-h-0 flex-1 overflow-x-auto'>
        <aside
          aria-label='流程节点面板'
          className='flex w-60 shrink-0 flex-col overflow-auto border-r border-border bg-white dark:bg-zinc-950'
        >
          <details open className='border-b border-border'>
            <summary className='cursor-pointer px-3 py-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring'>
              页面事件树
            </summary>
            <EventTree selected={target} onSelect={onTargetChange} />
          </details>
          <details open className='border-b border-border'>
            <summary className='cursor-pointer px-3 py-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring'>
              事件节点
            </summary>
            <div className='space-y-1 p-2 pt-0'>
              {nodeKinds.map((kind) => (
                <Button
                  key={kind.type}
                  variant='outline'
                  size='sm'
                  className='h-8 w-full cursor-grab justify-start text-xs font-normal active:cursor-grabbing'
                  title={`${kind.description}；拖入画布，或按 Enter 添加`}
                  disabled={!target}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    lfRef.current?.dnd.startDrag({
                      type: kind.type,
                      properties: defaultNodeProps(kind.type),
                    });
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    addWithKeyboard(kind.type);
                  }}
                >
                  {kind.title}
                </Button>
              ))}
            </div>
          </details>
        </aside>
        <div className='relative min-w-72 flex-1 bg-zinc-50 dark:bg-zinc-900'>
          {!target && (
            <div className='absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground'>
              从左侧页面事件树中选择事件，开始配置逻辑
            </div>
          )}
          <div ref={container} className='flow-canvas absolute inset-0' aria-label='事件流程画布' />
          {target && (
            <div className='absolute top-3 left-3 rounded-md border border-border bg-white/90 px-2.5 py-1.5 text-xs text-muted-foreground dark:bg-zinc-950/90'>
              {getElementLabel(
                target.elementId,
                schema.elements[target.elementId],
                String(
                  materials.find(
                    (material) => material.type === schema.elements[target.elementId]?.type,
                  )?.title ??
                    schema.elements[target.elementId]?.type ??
                    target.elementId,
                ),
              )}{' '}
              · {target.label}
            </div>
          )}
          {target && (
            <div className='absolute bottom-3 left-3 flex gap-1 rounded-lg border border-border bg-white p-1 shadow-sm dark:bg-zinc-950'>
              <Button
                size='icon-sm'
                variant='ghost'
                aria-label='撤销流程修改'
                disabled={!historyState.undoAble}
                onClick={() => {
                  lfRef.current?.undo();
                  commit();
                  setSelected(null);
                }}
              >
                <Undo2 size={16} />
              </Button>
              <Button
                size='icon-sm'
                variant='ghost'
                aria-label='重做流程修改'
                disabled={!historyState.redoAble}
                onClick={() => {
                  lfRef.current?.redo();
                  commit();
                  setSelected(null);
                }}
              >
                <Redo2 size={16} />
              </Button>
              <Button
                size='icon-sm'
                variant='ghost'
                aria-label='放大'
                onClick={() => lfRef.current?.zoom(true)}
              >
                <Plus size={16} />
              </Button>
              <Button
                size='icon-sm'
                variant='ghost'
                aria-label='缩小'
                onClick={() => lfRef.current?.zoom(false)}
              >
                <Minus size={16} />
              </Button>
              <Button
                size='icon-sm'
                variant='ghost'
                aria-label='适应画布'
                onClick={() => lfRef.current?.fitView(40, 40)}
              >
                <Maximize size={16} />
              </Button>
              <Button
                size='sm'
                variant='ghost'
                onClick={() => {
                  lfRef.current
                    ?.getSelectElements()
                    .edges.forEach((edge) => lfRef.current?.deleteEdge(edge.id));
                }}
              >
                删除选中连线
              </Button>
            </div>
          )}
        </div>
        <aside
          aria-label='流程节点配置'
          className='w-64 shrink-0 space-y-3 overflow-auto border-l border-border bg-white p-3 dark:bg-zinc-950'
        >
          <h3 className='border-b border-border pb-3 text-xs font-medium'>
            {selected
              ? String(
                  selected.properties?.title ||
                    getNodeDefinition(String(selected.type))?.title ||
                    '开始',
                )
              : '节点配置'}
          </h3>
          {!selected ? (
            <p className='text-xs text-muted-foreground'>请从左侧画布中选中节点</p>
          ) : (
            <NodeProperties
              key={selected.id}
              node={selected}
              onChange={update}
              eventLabel={target?.label}
            />
          )}
        </aside>
      </div>
    </section>
  );
};
