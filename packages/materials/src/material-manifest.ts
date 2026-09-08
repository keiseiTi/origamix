export const MATERIAL_MANIFEST_FORMAT_VERSION = '1.0' as const;

export type MaterialRole = 'layout' | 'input' | 'display' | 'action' | 'overlay';

export type JsonSchema = Readonly<Record<string, unknown>>;

export type MaterialContextEntry = Readonly<{
  name: string;
  description?: string;
  isMethod?: boolean;
  params?: readonly Readonly<{ description?: string }>[];
}>;

export type MaterialManifest = Readonly<{
  type: string;
  version: string;
  title: string;
  description: string;
  keywords: readonly string[];
  role: MaterialRole;
  propsSchema: JsonSchema;
  defaultProps: Readonly<Record<string, unknown>>;
  acceptsChildren: boolean;
  allowedParentTypes?: readonly string[];
  context: Readonly<{
    variables: readonly MaterialContextEntry[];
    values: readonly MaterialContextEntry[];
    methods: readonly MaterialContextEntry[];
  }>;
  usage: string;
  constraints: readonly string[];
}>;

export type ValidationMaterialManifest = Readonly<{
  type: string;
  version: string;
  propsSchema: JsonSchema;
  acceptsChildren: boolean;
  allowedParentTypes?: readonly string[];
  context: MaterialManifest['context'];
}>;

export type MaterialManifestCatalog = Readonly<{
  formatVersion: typeof MATERIAL_MANIFEST_FORMAT_VERSION;
  materialSet: Readonly<{
    id: string;
    version: string;
  }>;
  materials: readonly MaterialManifest[];
}>;

export type AgentMaterialSummary = Readonly<{
  type: string;
  title: string;
  description: string;
  role: MaterialRole;
  keywords: readonly string[];
}>;

export function toAgentMaterialSummary(manifest: MaterialManifest): AgentMaterialSummary {
  return {
    type: manifest.type,
    title: manifest.title,
    description: manifest.description,
    role: manifest.role,
    keywords: manifest.keywords,
  };
}

export function toValidationMaterialManifest(
  manifest: MaterialManifest,
): ValidationMaterialManifest {
  return {
    type: manifest.type,
    version: manifest.version,
    propsSchema: manifest.propsSchema,
    acceptsChildren: manifest.acceptsChildren,
    allowedParentTypes: manifest.allowedParentTypes,
    context: manifest.context,
  } as const;
}
