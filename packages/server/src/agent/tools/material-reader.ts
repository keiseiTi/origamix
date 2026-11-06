import type { AgentMaterialSummary, MaterialManifestCatalog } from '@origamix/shared';

export type ProjectMaterialReader = (projectPath: string) => Promise<{
  manifest: MaterialManifestCatalog;
  blocks?: readonly import('@origamix/shared').BlockDefinition[];
  agentCatalog: readonly AgentMaterialSummary[];
}>;
