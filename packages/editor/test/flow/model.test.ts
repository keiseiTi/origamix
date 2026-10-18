import { describe, expect, it } from 'vitest';
import type LogicFlow from '@logicflow/core';
import type { Schema } from '@tangramino/engine';
import { isFlowNodeProps } from '@origamix/shared';
import { readGraph, toFlow } from '../../src/flow-editor/model';

// Server cannot check the canvas-to-engine translation or prevent recursive
// Engine traversal of a newly connected graph before it becomes a draft.
describe('event graph commit', () => {
  it('preserves executable connections and rejects a cycle before committing', () => {
    const graph: LogicFlow.GraphData = {
      nodes: [
        { id: 'start', type: 'start', x: 0, y: 0 },
        {
          id: 'action',
          type: 'setElementProps',
          x: 200,
          y: 0,
          properties: {
            width: 148,
            height: 48,
            setters: [{ elementId: 'button', propName: 'text', value: '完成' }],
          },
        },
      ],
      edges: [
        {
          id: 'edge',
          type: 'polyline',
          sourceNodeId: 'start',
          targetNodeId: 'action',
          startPoint: { x: 0, y: 0 },
          endPoint: { x: 200, y: 0 },
        },
      ],
    };
    const flow = toFlow(graph);
    expect(flow.startId).toBe('start');
    expect(flow.nodes.start?.next).toEqual(['action']);
    expect(flow.nodes.action?.props).toEqual({
      setters: [{ elementId: 'button', propName: 'text', value: '完成' }],
    });
    expect(isFlowNodeProps('setElementProps', flow.nodes.action?.props)).toBe(true);
    expect(graph.nodes[1]?.properties?.width).toBe(148);
    const schema: Schema = {
      elements: {},
      layout: { root: 'root', structure: {} },
      bindElements: [{ id: 'button', event: 'onClick', flowId: 'flow' }],
      flows: {
        flow: {
          ...flow,
          nodes: {
            ...flow.nodes,
            action: {
              ...flow.nodes.action!,
              props: { setters: [{ elementId: 'button', propName: 'text', value: 'Agent 更新' }] },
            },
          },
        },
      },
      extensions: { flowGraph: { 'button::onClick': graph } },
    };
    expect(
      toFlow(readGraph(schema, { elementId: 'button', event: 'onClick', label: '点击事件' })).nodes
        .action?.props,
    ).toEqual({ setters: [{ elementId: 'button', propName: 'text', value: 'Agent 更新' }] });
    graph.edges.push({
      ...graph.edges[0]!,
      id: 'cycle',
      sourceNodeId: 'action',
      targetNodeId: 'action',
    });
    expect(() => toFlow(graph)).toThrow('循环');
    expect(flow.nodes.action?.next).toEqual([]);
  });
  it('preserves true/false branch ownership on reconstruction and rejects duplicate branch connections', () => {
    const graph: LogicFlow.GraphData = {
      nodes: [
        { id: 'start', type: 'start', x: 0, y: 0 },
        { id: 'check', type: 'condition', x: 200, y: 0, properties: { judgment: true } },
        { id: 'yes', type: 'openModalDrawer', x: 400, y: 0 },
        { id: 'no', type: 'closeModalDrawer', x: 400, y: 100 },
      ],
      edges: [
        {
          id: 'entry',
          type: 'polyline',
          startPoint: { x: 0, y: 0 },
          endPoint: { x: 0, y: 0 },
          sourceNodeId: 'start',
          targetNodeId: 'check',
        },
        {
          id: 'true',
          type: 'polyline',
          startPoint: { x: 0, y: 0 },
          endPoint: { x: 0, y: 0 },
          sourceNodeId: 'check',
          sourceAnchorId: 'check_true',
          targetNodeId: 'yes',
        },
        {
          id: 'false',
          type: 'polyline',
          startPoint: { x: 0, y: 0 },
          endPoint: { x: 0, y: 0 },
          sourceNodeId: 'check',
          sourceAnchorId: 'check_false',
          targetNodeId: 'no',
        },
      ],
    };
    const flow = toFlow(graph);
    expect(flow.nodes.check?.props.condition).toEqual([
      { value: true, nextNode: 'yes' },
      { value: false, nextNode: 'no' },
    ]);
    const restored = readGraph(
      {
        elements: {},
        layout: { root: 'root', structure: {} },
        extensions: {},
        bindElements: [{ id: 'button', event: 'onClick', flowId: 'flow' }],
        flows: { flow },
      } as Schema,
      { elementId: 'button', event: 'onClick', label: '点击' },
    );
    expect(toFlow(restored).nodes.check?.props.condition).toEqual(
      flow.nodes.check?.props.condition,
    );
    const sharedTarget = structuredClone(graph);
    sharedTarget.edges[2]!.targetNodeId = 'yes';
    const sharedFlow = toFlow(sharedTarget);
    const sharedRestored = readGraph(
      {
        elements: {},
        layout: { root: 'root', structure: {} },
        extensions: {},
        bindElements: [{ id: 'button', event: 'onClick', flowId: 'flow' }],
        flows: { flow: sharedFlow },
      } as Schema,
      { elementId: 'button', event: 'onClick', label: '点击' },
    );
    expect(toFlow(sharedRestored).nodes.check?.props.condition).toEqual(
      sharedFlow.nodes.check?.props.condition,
    );
    graph.edges.push({
      id: 'duplicate',
      type: 'polyline',
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 0, y: 0 },
      sourceNodeId: 'check',
      sourceAnchorId: 'check_true',
      targetNodeId: 'no',
    });
    expect(() => toFlow(graph)).toThrow('分支');
    expect(flow.nodes.check?.next).toEqual(['yes', 'no']);
  });
});
