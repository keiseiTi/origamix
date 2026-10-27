import type { AgentMaterialSummary, MaterialManifestCatalog } from '@origamix/shared';

export type ProjectMaterialReader = (projectPath: string) => Promise<{
  manifest: MaterialManifestCatalog;
  agentCatalog: readonly AgentMaterialSummary[];
}>;
