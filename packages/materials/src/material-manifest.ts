import { layoutProperties } from './layout-properties';
import type {
  AgentMaterialSummary,
  JsonSchema,
  MaterialManifest,
  ValidationMaterialManifest,
} from '@origamix/shared';

export const commonMaterialProperties = {
  ...layoutProperties,
  alias: { type: 'string', description: '元素别名，用于说明元素用途。' },
  tabKey: { type: 'string', description: '父级页签内容归属。' },
} as const;

export const commonInitEvent = { name: 'init', description: '初始化' } as const;

/** Platform properties and lifecycle events shared by all material families. */
export const withCommonMaterialManifest = (manifest: MaterialManifest): MaterialManifest => ({
  ...manifest,
  propsSchema: {
    ...manifest.propsSchema,
    properties: {
      ...(manifest.propsSchema.properties as Readonly<Record<string, JsonSchema>>),
      ...commonMaterialProperties,
    },
    required:
      (manifest.propsSchema.required as readonly string[] | undefined)?.filter(
        (field) => field !== 'alias',
      ) ?? [],
  },
  context: {
    ...manifest.context,
    events: manifest.context.events.some((event) => event.name === 'init')
      ? manifest.context.events
      : [commonInitEvent, ...manifest.context.events],
  },
});

export const toAgentMaterialSummary = (manifest: MaterialManifest): AgentMaterialSummary => {
  return {
    type: manifest.type,
    title: manifest.title,
    description: manifest.description,
    role: manifest.role,
    keywords: manifest.keywords,
    defaultProps: manifest.defaultProps,
    acceptsChildren: manifest.acceptsChildren,
    layout: manifest.layout,
    allowedParentTypes: manifest.allowedParentTypes,
    usage: manifest.usage,
    constraints: manifest.constraints,
  };
};

export const toValidationMaterialManifest = (
  manifest: MaterialManifest,
): ValidationMaterialManifest => {
  return {
    type: manifest.type,
    version: manifest.version,
    propsSchema: manifest.propsSchema,
    acceptsChildren: manifest.acceptsChildren,
    layout: manifest.layout,
    allowedParentTypes: manifest.allowedParentTypes,
    context: manifest.context,
  } as const;
};
