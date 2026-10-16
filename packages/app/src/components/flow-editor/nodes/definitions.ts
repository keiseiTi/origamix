import {
  flowNodeManifests,
  getFlowNodeManifest,
  type FlowNodeManifest,
} from '@origamix/shared/protocol/flow-node';

export type LogicNodeDefinition = FlowNodeManifest;
export const startNode = getFlowNodeManifest('start')!;
export const nodeKinds = flowNodeManifests.filter((node) => node.type !== 'start');
export const getNodeDefinition = getFlowNodeManifest;

/** Each insertion owns its nested drafts; never mutate the shared catalog. */
export const defaultNodeProps = (type: string): Record<string, unknown> =>
  structuredClone(getNodeDefinition(type)?.defaultProps ?? {});

export const getNodePropertySchema = (type: string, field: string): Record<string, unknown> =>
  getNodeDefinition(type)?.propsSchema.properties?.[field] ?? {};

export const getNodePropertyChoices = (type: string, field: string): string[] => {
  const schema = getNodePropertySchema(type, field);
  const variants = Array.isArray(schema.anyOf) ? schema.anyOf : [];
  return variants.flatMap((item: Record<string, unknown>) =>
    typeof item.const === 'string' ? [item.const] : [],
  );
};
