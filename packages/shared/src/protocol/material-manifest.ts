export const MATERIAL_MANIFEST_FORMAT_VERSION = '1.0' as const;

export type MaterialRole = 'layout' | 'input' | 'display' | 'action' | 'overlay';

export type JsonSchema = Readonly<Record<string, unknown>>;

export type MaterialContextEntry = Readonly<{
  name: string;
  description?: string;
  isMethod?: boolean;
  linkageShow?: readonly Readonly<{ field: string; value?: unknown; isNotEmpty?: boolean }>[];
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
    /** Runtime setters are independent of readable business values and design-time props. */
    writable?: readonly MaterialContextEntry[];
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
  defaultProps: Readonly<Record<string, unknown>>;
  acceptsChildren: boolean;
  allowedParentTypes?: readonly string[];
  usage: string;
  constraints: readonly string[];
}>;
