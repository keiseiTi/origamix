// Compatibility entry: the platform-neutral format is owned by Shared.
export * from '@origamix/shared/protocol/material-manifest';
import type {
  AgentMaterialSummary,
  JsonSchema,
  MaterialManifest,
  ValidationMaterialManifest,
} from '@origamix/shared/protocol/material-manifest';

/** Platform properties and lifecycle events shared by all material families. */
export const withCommonMaterialManifest = (manifest: MaterialManifest): MaterialManifest => ({
  ...manifest,
  propsSchema: {
    ...manifest.propsSchema,
    properties: {
      ...(manifest.propsSchema.properties as Readonly<Record<string, JsonSchema>>),
      alias: { type: 'string', description: '元素别名，用于说明元素用途。' },
    },
    required:
      (manifest.propsSchema.required as readonly string[] | undefined)?.filter(
        (field) => field !== 'alias',
      ) ?? [],
  },
  context: {
    ...manifest.context,
    methods: manifest.context.methods.some((method) => method.name === 'init')
      ? manifest.context.methods
      : [{ name: 'init', description: '初始化' }, ...manifest.context.methods],
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
    allowedParentTypes: manifest.allowedParentTypes,
    context: manifest.context,
  } as const;
};
