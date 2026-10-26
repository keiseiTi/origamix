import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';

export const ProjectUpgradeRequestSchema = Type.Object({
  expectedVersion: Type.String({ minLength: 1, maxLength: 40 }),
  clientRequestId: Type.String({ pattern: '^[A-Za-z0-9_-]{1,40}$' }),
});

export const CancelProjectUpgradeRequestSchema = Type.Pick(ProjectUpgradeRequestSchema, [
  'clientRequestId',
]);

export interface ProjectUpgradeState {
  version: string;
  targetVersion: string;
  upgrade: { requestId: string; from: string; to: string; state: 'pending' | 'completed' } | null;
}

export interface ProjectUpgradeResult {
  projectId: string;
  version: string;
  status: 'completed';
  installRequired: true;
}

export type ProjectUpgradeRequest = Static<typeof ProjectUpgradeRequestSchema>;
