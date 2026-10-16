import type {
  AgentMaterialSummary,
  MaterialManifestCatalog,
} from '@origamix/shared/protocol/material-manifest';

export type ProjectMaterialReader = (projectPath: string) => Promise<{
  manifest: MaterialManifestCatalog;
  agentCatalog: readonly AgentMaterialSummary[];
}>;
