import { nanoid } from 'nanoid';
import { equalJson, getElementLabel } from '@origamix/shared';
import { useToastManager } from '@origamix/ui';
import LogicFlow from '@logicflow/core';
import { SelectionSelect } from '@logicflow/extension';
import { useEffect, useRef, useState } from 'react';
import { useFlowEditorSession } from '../flow-editor-context';
import { SchemaUtils } from '../../../schema/schema-utils';
import { nodeKinds, readGraph, toFlow, type EventTarget } from '../flow-graph';
import { createReactNode } from '../flow-node-renderer';
import { defaultNodeProps } from '../nodes/node-catalog';
export const useFlowCanvas = (target: EventTarget | null) => {
  const { schema, materials, onChange, history } = useFlowEditorSession();
  const container = useRef<HTMLDivElement>(null);
  const lfRef = useRef<LogicFlow | null>(null);
  const lastGraph = useRef<LogicFlow.GraphData>({ nodes: [], edges: [] });
  const [selected, setSelected] = useState<LogicFlow.NodeData | null>(null);
  const historyRef = useRef(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);
  const notifications = useToastManager();
  const schemaRef = useRef(schema);
  useEffect(() => {
    schemaRef.current = schema;
  }, [schema]);
  const commit = (): void => {
    const schema = schemaRef.current;
    const lf = lfRef.current;
    if (!lf || !target) return;
    const graph = lf.getGraphRawData();
    if (equalJson(graph, lastGraph.current)) return;
    try {
      const flow = toFlow(graph);
      const binding = schema.bindElements?.find(
        (item) => item.id === target.elementId && item.event === target.event,
      );
      const next = SchemaUtils.setEventFlow(
        schema,
        target.elementId,
        target.event,
        binding?.flowId ?? `flow-${nanoid()}`,
        flow,
      );
      lastGraph.current = structuredClone(graph);
      const candidate = SchemaUtils.setFlowGraph(
        next,
        `${target.elementId}::${target.event}`,
        graph,
      );
      schemaRef.current = candidate;
      onChange(candidate);
    } catch (reason) {
      lf.render(structuredClone(lastGraph.current));
      notifications.add({
        id: 'editor-flow-error',
        type: 'error',
        priority: 'high',
        title: reason instanceof Error ? reason.message : '流程更新失败',
        description: '已保留上一次有效流程。',
      });
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
      history: false,
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
    lastGraph.current = structuredClone(lf.getGraphRawData());
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
      historyRef.current.undo();
      setSelected(null);
      lf.container.focus();
      return false;
    });
    lf.keyboard.on(['cmd+y', 'ctrl+y', 'cmd+shift+z', 'ctrl+shift+z'], () => {
      historyRef.current.redo();
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
    if (equalJson(graph, lastGraph.current)) return;
    lf.render(graph);
    lastGraph.current = structuredClone(lf.getGraphRawData());
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
  return {
    schema,
    materials,
    history,
    container,
    lfRef,
    selected,
    setSelected,
    update,
    addWithKeyboard,
  };
};
