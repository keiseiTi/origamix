import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import type { ProjectStack } from './project-stack.ts';
export const ProjectUpgradeRequestSchema = Type.Object({
  expectedVersion: Type.Literal('1.0.0'),
  expectedManifestHash: Type.String({ pattern: '^[a-f0-9]{64}$' }),
  clientRequestId: Type.String({ pattern: '^[A-Za-z0-9_-]{1,40}$' }),
});
export const CancelProjectUpgradeRequestSchema = Type.Pick(ProjectUpgradeRequestSchema, [
  'clientRequestId',
]);
export interface ProjectUpgradeState {
  status: 'compatible' | 'blocked' | 'configuration_conversion_required';
  materialSet: ProjectStack['materialSet'];
  supportedMaterialSet: ProjectStack['materialSet'];
  schemaVersion: string;
  legacyVersion: string | null;
  manifestHash: string;
  issues: string[];
  pages: Array<{
    pageId: string;
    name: string;
    schemaVersion: string | null;
    issue: string | null;
  }>;
  upgrade: { requestId: string; from: string; to: string; state: 'pending' | 'completed' } | null;
}
export interface ProjectUpgradeResult {
  projectId: string;
  status: 'completed';
  installRequired: false;
}
export type ProjectUpgradeRequest = Static<typeof ProjectUpgradeRequestSchema>;
