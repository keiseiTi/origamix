import { Type, type Static } from '@sinclair/typebox';
import { Check } from '@sinclair/typebox/value';
import { PageSchema, type OrigamixPageSchema } from '../page/page-schema.ts';
import { isPageSchema } from '../page/page-validation.ts';
import type { SchemaOperation } from '../page/schema-operation.ts';
import { isHyperValue } from '../flow/hyper-value.ts';

export const BlockDefinitionSchema = Type.Object(
  {
    id: Type.String({ pattern: '^[a-z][a-z0-9-]*$' }),
    title: Type.String({ minLength: 1 }),
    description: Type.String(),
    schema: PageSchema,
    parameters: Type.Array(
      Type.Object(
        {
          name: Type.String({ pattern: '^[A-Za-z][A-Za-z0-9_]*$' }),
          label: Type.String(),
          paths: Type.Array(Type.Array(Type.String(), { minItems: 1 }), { minItems: 1 }),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);
export type BlockDefinition = Static<typeof BlockDefinitionSchema>;

/** One expansion produces ordinary nodes. Only protocol references are rewritten; code is never evaluated. */
export const instantiateBlock = (input: {
  block: BlockDefinition;
  schema: OrigamixPageSchema;
  parentId: string;
  index?: number;
  parameters: Record<string, string>;
  createId: () => string;
}): { schema: OrigamixPageSchema; operations: SchemaOperation[]; rootId: string } => {
  const { block, schema, parentId } = input;
  if (!Check(BlockDefinitionSchema, block) || !isPageSchema(block.schema) || !isPageSchema(schema))
    throw new Error('组合模块结构无效');
  if (!Object.hasOwn(schema.elements, parentId)) throw new Error('目标容器不存在');
  const fragment = structuredClone(block.schema);
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    for (const child of fragment.layout.structure[id] ?? []) visit(child);
  };
  visit(fragment.layout.root);
  if (visited.size !== Object.keys(fragment.elements).length) throw new Error('模块含有不可达元素');
  for (const parameter of block.parameters) {
    const value = input.parameters[parameter.name]?.trim();
    if (!value) throw new Error(`请配置${parameter.label}`);
    for (const path of parameter.paths) {
      let target: unknown = fragment;
      for (const key of path.slice(0, -1)) {
        if (
          ['__proto__', 'constructor', 'prototype'].includes(key) ||
          !target ||
          typeof target !== 'object' ||
          !Object.hasOwn(target, key)
        )
          throw new Error('模块参数路径无效');
        target = (target as Record<string, unknown>)[key];
      }
      const key = path.at(-1)!;
      if (
        ['__proto__', 'constructor', 'prototype'].includes(key) ||
        !target ||
        typeof target !== 'object' ||
        !Object.hasOwn(target, key)
      )
        throw new Error('模块参数路径无效');
      (target as Record<string, unknown>)[key] = value;
    }
  }
  const used = new Set([
    ...Object.keys(schema.elements),
    ...Object.keys(schema.flows),
    ...Object.values(schema.flows).flatMap((flow) => Object.keys(flow.nodes)),
    ...schema.context.globalVariables.map((variable) => variable.name),
  ]);
  const fresh = () => {
    const id = input.createId();
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(id) || used.has(id)) throw new Error('组合模块标识冲突');
    used.add(id);
    return id;
  };
  const elements = new Map(Object.keys(fragment.elements).map((id) => [id, fresh()]));
  const flows = new Map(Object.keys(fragment.flows).map((id) => [id, fresh()]));
  const variables = new Map(
    fragment.context.globalVariables.map((variable) => [variable.name, fresh()]),
  );
  const context = (reference: string, nodes: Map<string, string>) => {
    const [kind, name, ...path] = reference.split('.');
    const map =
      kind === 'state' || kind === 'method'
        ? elements
        : kind === 'result'
          ? nodes
          : kind === 'global'
            ? variables
            : null;
    if (!map) return reference;
    const mapped = map.get(name!);
    if (!mapped) throw new Error('模块上下文引用未声明');
    return [kind, mapped, ...path].join('.');
  };
  const rewrite = (value: unknown, nodes: Map<string, string>): unknown => {
    if (isHyperValue(value)) {
      if (value.type === 'contextValue') return { ...value, value: context(value.value, nodes) };
      if (value.type === 'function')
        return {
          ...value,
          value: {
            ...value.value,
            params: value.value.params.map((param) => ({
              ...param,
              value: context(param.value, nodes),
            })),
          },
        };
      return value;
    }
    if (Array.isArray(value)) return value.map((item) => rewrite(item, nodes));
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, rewrite(item, nodes)]),
      );
    return value;
  };
  const mapElement = (id: string) => {
    const mapped = elements.get(id);
    if (!mapped) throw new Error('模块引用了外部元素');
    return mapped;
  };
  const expanded = Object.fromEntries(
    Object.entries(fragment.elements).map(([id, element]) => [
      mapElement(id),
      { ...element, props: rewrite(element.props, new Map()) as Record<string, unknown> },
    ]),
  );
  const structure = Object.fromEntries(
    Object.keys(fragment.elements).map((id) => [
      mapElement(id),
      (fragment.layout.structure[id] ?? []).map(mapElement),
    ]),
  );
  const expandedFlows = Object.fromEntries(
    Object.entries(fragment.flows).map(([id, flow]) => {
      const nodes = new Map(Object.keys(flow.nodes).map((nodeId) => [nodeId, fresh()]));
      const mapNode = (nodeId: string) => {
        const mapped = nodes.get(nodeId);
        if (!mapped) throw new Error('模块逻辑节点引用无效');
        return mapped;
      };
      return [
        flows.get(id)!,
        {
          startId: mapNode(flow.startId),
          nodes: Object.fromEntries(
            Object.entries(flow.nodes).map(([nodeId, node]) => {
              const props = rewrite(node.props, nodes) as Record<string, unknown>;
              if (node.type === 'setElementProps' || node.type === 'emitElementAction')
                props.setters = (props.setters as Record<string, unknown>[]).map((setter) => ({
                  ...setter,
                  elementId: mapElement(String(setter.elementId)),
                }));
              if (node.type === 'visibleElement')
                props.elementIds = (props.elementIds as string[]).map(mapElement);
              if (node.type === 'openModalDrawer' || node.type === 'closeModalDrawer')
                props.elementId = mapElement(String(props.elementId));
              if (node.type === 'condition' && Array.isArray(props.condition))
                props.condition = (props.condition as { value: boolean; nextNode: string }[]).map(
                  (branch) => ({ ...branch, nextNode: mapNode(branch.nextNode) }),
                );
              if (node.type === 'setGlobalVariable')
                props.setters = (props.setters as Record<string, unknown>[]).map((setter) => {
                  const name = variables.get(String(setter.name));
                  if (!name) throw new Error('模块变量引用无效');
                  return { ...setter, name };
                });
              return [
                mapNode(nodeId),
                {
                  ...node,
                  id: mapNode(nodeId),
                  prev: node.prev.map(mapNode),
                  next: node.next.map(mapNode),
                  props,
                },
              ];
            }),
          ),
        },
      ];
    }),
  );
  const bindings = fragment.bindElements.map((binding) => ({
    ...binding,
    id: mapElement(binding.id),
    flowId: flows.get(binding.flowId)!,
  }));
  const globalVariables = [
    ...schema.context.globalVariables,
    ...fragment.context.globalVariables.map((variable) => ({
      ...variable,
      name: variables.get(variable.name)!,
    })),
  ];
  const rootId = mapElement(fragment.layout.root);
  const children = [...(schema.layout.structure[parentId] ?? [])];
  const index = input.index ?? children.length;
  if (!Number.isInteger(index) || index < 0 || index > children.length)
    throw new Error('模块插入位置无效');
  children.splice(index, 0, rootId);
  const candidate: OrigamixPageSchema = {
    ...schema,
    elements: { ...schema.elements, ...expanded },
    layout: {
      ...schema.layout,
      structure: { ...schema.layout.structure, ...structure, [parentId]: children },
    },
    flows: { ...schema.flows, ...expandedFlows },
    bindElements: [...schema.bindElements, ...bindings],
    context: { globalVariables },
  };
  if (!isPageSchema(candidate)) throw new Error('组合模块展开结果无效');
  const operations: SchemaOperation[] = [
    {
      operation: 'insertSubtree',
      rootElementId: rootId,
      elements: expanded,
      structure,
      parentId,
      index,
    },
    ...Object.entries(expandedFlows).map(([flowId, flow]): SchemaOperation => ({
      operation: 'addFlow',
      flowId,
      flow,
    })),
    ...bindings.map((binding) => ({
      operation: 'setElementEventBinding' as const,
      elementId: binding.id,
      event: binding.event,
      flowId: binding.flowId,
    })),
    ...(variables.size ? [{ operation: 'updatePageContext' as const, globalVariables }] : []),
  ];
  return { schema: candidate, operations, rootId };
};
