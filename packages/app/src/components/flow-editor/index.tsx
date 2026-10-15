import LogicFlow from '@logicflow/core';
import { SelectionSelect } from '@logicflow/extension';
import '@logicflow/core/lib/style/index.css';
import '@logicflow/extension/lib/style/index.css';
import { useEffect, useRef, useState } from 'react';
import { useEditorCore } from '@tangramino/base-editor';
import { SchemaUtils } from '@tangramino/engine';
import { ArrowLeft, Maximize, Minus, Plus, Trash2, Undo2, Redo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { JsonAttributeField } from '../editor/mods/json-attribute-field';
import { nodeKinds, readGraph, toFlow, type EventTarget } from './model';
import { reactNode } from './react-node';
import './style.css';
import { FlowSelect } from './flow-select';

export const FlowEditor = ({
  target,
  onClose,
}: {
  target: EventTarget;
  onClose: () => void;
}): React.JSX.Element => {
  const schema = useEditorCore((state) => state.schema);
  const setSchema = useEditorCore((state) => state.setSchema);
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
    if (!lf) return;
    const graph = lf.getGraphRawData();
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
      setSchema(candidate);
      setError(null);
    } catch (reason) {
      lf.render(JSON.parse(lastGraph.current) as LogicFlow.GraphData);
      setError(reason instanceof Error ? reason.message : '流程更新失败');
    }
  };
  const initialGraph = useRef(readGraph(schema, target));
  useEffect(() => {
    if (!container.current) return;
    const lf = new LogicFlow({
      container: container.current,
      grid: { size: 20, type: 'dot', config: { color: '#a1a1aa', thickness: 1 } },
      background: { backgroundColor: 'transparent' },
      plugins: [SelectionSelect],
      keyboard: { enabled: false },
      history: true,
      edgeTextEdit: false,
      nodeTextEdit: false,
      adjustEdge: false,
    });
    lfRef.current = lf;
    lf.register({ type: 'start', ...reactNode });
    nodeKinds.forEach((kind) => lf.register({ type: kind.type, ...reactNode }));
    lf.setTheme({
      polyline: { stroke: '#71717a', strokeWidth: 2 },
      anchor: { fill: '#ffffff', stroke: '#6366f1', r: 5 },
    });
    lf.render(initialGraph.current);
    lastGraph.current = JSON.stringify(lf.getGraphRawData());
    lf.on('node:click', ({ data }) => setSelected(data));
    lf.on('blank:click', () => setSelected(null));
    lf.on('history:change', ({ data }) =>
      setHistoryState({ undoAble: data.undoAble, redoAble: data.redoAble }),
    );
    lf.on(
      'node:add,node:delete,node:drop,node:properties-change,edge:add,edge:delete,edge:adjust',
      () => commit(),
    );
    lf.setDefaultEdgeType('polyline');
    const observer = new ResizeObserver(() => lf.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      lfRef.current = null;
      lf.destroy();
    };
    // The event target owns one mounted canvas; schema changes are reconciled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const lf = lfRef.current;
    if (!lf) return;
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
  const add = (type: string): void => {
    const lf = lfRef.current;
    if (!lf) return;
    const existing = lf.getGraphRawData().nodes;
    const node = lf.addNode({
      type,
      x: Math.max(...existing.map((item) => item.x)) + 260,
      y: 180,
      properties: {},
    });
    lf.fitView(40, 40);
    lf.selectElementById(node.id);
    setSelected(node.getData());
  };
  const properties = selected?.properties ?? {};
  const displayedGraph = readGraph(schema, target);
  const selectNode = (id: string): void => {
    lfRef.current?.selectElementById(id);
    setSelected(lfRef.current?.getNodeDataById(id) ?? null);
  };
  return (
    <section
      className='flex min-h-0 flex-1 flex-col bg-background text-foreground'
      aria-label='逻辑编辑器'
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) onClose();
      }}
      tabIndex={-1}
    >
      <header className='flex min-h-11 items-center gap-3 border-b px-3'>
        <Button size='sm' variant='ghost' onClick={onClose} autoFocus>
          <ArrowLeft size={14} />
          视图编辑
        </Button>
        <span className='text-sm font-medium'>逻辑编辑</span>
        <span className='truncate text-xs text-muted-foreground'>
          {target.elementId} · {target.label}
        </span>
      </header>
      {error && (
        <div role='alert' className='border-b bg-destructive/10 px-4 py-2 text-sm text-destructive'>
          {error}，已保留上一次有效流程。
        </div>
      )}
      <div className='flex min-h-0 flex-1 overflow-x-auto'>
        <aside
          aria-label='流程节点面板'
          className='w-48 shrink-0 space-y-3 overflow-auto border-r p-3'
        >
          <h3 className='text-sm font-medium'>节点属性</h3>
          <p className='text-xs text-muted-foreground'>点击添加节点，拖动锚点连接执行顺序。</p>
          {nodeKinds.map((kind) => (
            <Button
              key={kind.type}
              variant='outline'
              className='h-auto w-full flex-col items-start whitespace-normal py-3 text-left'
              onClick={() => add(kind.type)}
            >
              <span>{kind.title}</span>
              <span className='text-xs font-normal text-muted-foreground'>{kind.description}</span>
            </Button>
          ))}
          <h3 className='border-t pt-3 text-xs font-medium'>当前流程</h3>
          {displayedGraph.nodes.map((node) => (
            <Button
              key={node.id}
              variant={selected?.id === node.id ? 'secondary' : 'ghost'}
              size='sm'
              className='w-full justify-start truncate'
              onClick={() => selectNode(node.id)}
            >
              {String(
                node.properties?.title ||
                  nodeKinds.find((kind) => kind.type === node.type)?.title ||
                  '开始',
              )}
            </Button>
          ))}
          {selected && (
            <div className='space-y-2 border-t pt-3'>
              <FlowSelect
                label='下一节点'
                value=''
                options={displayedGraph.nodes
                  .filter((node) => node.type !== 'start' && node.id !== selected.id)
                  .map((node) => ({
                    value: node.id,
                    label: String(
                      node.properties?.title ||
                        nodeKinds.find((kind) => kind.type === node.type)?.title ||
                        node.type,
                    ),
                  }))}
                onChange={(id) =>
                  lfRef.current?.addEdge({
                    type: 'polyline',
                    sourceNodeId: selected.id,
                    targetNodeId: id,
                  })
                }
              />
              {displayedGraph.edges
                .filter(
                  (edge) => edge.sourceNodeId === selected.id || edge.targetNodeId === selected.id,
                )
                .map((edge) => (
                  <Button
                    key={edge.id}
                    variant='outline'
                    size='sm'
                    className='w-full'
                    onClick={() => lfRef.current?.deleteEdge(edge.id)}
                  >
                    删除连线{' '}
                    {displayedGraph.nodes.findIndex((node) => node.id === edge.sourceNodeId) + 1} →{' '}
                    {displayedGraph.nodes.findIndex((node) => node.id === edge.targetNodeId) + 1}
                  </Button>
                ))}
            </div>
          )}
        </aside>
        <div className='relative min-w-72 flex-1'>
          <div ref={container} className='flow-canvas absolute inset-0' aria-label='事件流程画布' />
          <div className='absolute bottom-4 left-4 flex gap-1 rounded-lg border bg-background p-1 shadow-sm'>
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
        </div>
        <aside
          aria-label='流程节点配置'
          className='w-64 shrink-0 space-y-4 overflow-auto border-l p-4'
        >
          <h3 className='text-sm font-medium'>节点配置</h3>
          {!selected ? (
            <p className='text-xs text-muted-foreground'>请从画布中选中节点</p>
          ) : selected.type === 'start' ? (
            <p className='text-sm text-muted-foreground'>
              {target.label}触发后，从此节点开始执行。
            </p>
          ) : (
            <>
              <FieldLabel>节点名称</FieldLabel>
              <Input
                aria-label='节点名称'
                value={String(properties.title ?? '')}
                placeholder={nodeKinds.find((kind) => kind.type === selected.type)?.title}
                onChange={(event) => update({ title: event.target.value })}
              />
              {selected.type !== 'setGlobalVariable' ? (
                <>
                  <FieldLabel>目标组件</FieldLabel>
                  <FlowSelect
                    label='目标组件'
                    value={String(properties.elementId ?? '')}
                    onChange={(value) => update({ elementId: value })}
                    options={Object.entries(schema.elements).map(([id, element]) => ({
                      value: id,
                      label: `${element.type} · ${id}`,
                    }))}
                  />
                </>
              ) : (
                <>
                  <FieldLabel>全局变量</FieldLabel>
                  <FlowSelect
                    label='全局变量'
                    value={String(properties.name ?? '')}
                    onChange={(value) => update({ name: value })}
                    options={(schema.context?.globalVariables ?? []).map((variable) => ({
                      value: variable.name,
                      label: variable.name,
                    }))}
                  />
                </>
              )}
              {selected.type === 'visibleElement' ? (
                <Button
                  variant='outline'
                  onClick={() => update({ visible: properties.visible === false })}
                >
                  {properties.visible === false ? '隐藏组件' : '显示组件'}
                </Button>
              ) : (
                <JsonAttributeField
                  key={`${selected.id}:${JSON.stringify(properties)}`}
                  label={
                    selected.type === 'setElementProps' ? '属性对象（JSON）' : '变量值（JSON）'
                  }
                  value={
                    selected.type === 'setElementProps'
                      ? (properties.value ?? {})
                      : (properties.value ?? null)
                  }
                  validateValue={
                    selected.type === 'setElementProps'
                      ? (value) =>
                          value !== null && typeof value === 'object' && !Array.isArray(value)
                            ? undefined
                            : '请输入属性对象'
                      : () => undefined
                  }
                  onChange={(value) => update({ value })}
                />
              )}
              <Button
                variant='outline'
                onClick={() => {
                  lfRef.current?.deleteNode(selected.id);
                  setSelected(null);
                }}
              >
                <Trash2 size={14} />
                删除节点
              </Button>
            </>
          )}
        </aside>
      </div>
    </section>
  );
};
