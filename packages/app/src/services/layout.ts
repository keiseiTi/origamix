import {
  isLayoutConfigState,
  isLayoutWorkingState,
  isLayoutRevisionHistory,
  isLayoutRevisionSnapshot,
  isLayoutApplyResult,
  isLayoutApplyState,
  type LayoutConfigState,
  type LayoutWorkingState,
  type LayoutRevisionHistory,
  type LayoutRevisionSnapshot,
  type LayoutApplyResult,
  type LayoutApplyState,
  type SchemaOperation,
  type OrigamixPageSchema,
} from '@origamix/shared';
import { request } from './request';

export const layoutService = {
  config: (projectId: string) =>
    request<LayoutConfigState>('/layout/config/get', { projectId }, isLayoutConfigState),
  setEnabled: (projectId: string, enabled: boolean) =>
    request<LayoutConfigState>(
      '/layout/config/update',
      { projectId, enabled },
      isLayoutConfigState,
    ),
  workingState: (projectId: string) =>
    request<LayoutWorkingState>('/layout/working/get', { projectId }, isLayoutWorkingState),
  operations: (
    projectId: string,
    baseWorkingVersion: number,
    operations: readonly SchemaOperation[],
    clientRequestId: string,
  ) =>
    request<LayoutWorkingState>(
      '/layout/working/operations',
      { projectId, baseWorkingVersion, operations, clientRequestId },
      isLayoutWorkingState,
    ),
  update: (
    projectId: string,
    baseWorkingVersion: number,
    schema: OrigamixPageSchema,
    clientRequestId: string,
  ) =>
    request<LayoutWorkingState>(
      '/layout/working/update',
      { projectId, baseWorkingVersion, schema, clientRequestId },
      isLayoutWorkingState,
    ),
  saveRevision: (projectId: string, expectedWorkingVersion: number) =>
    request<LayoutWorkingState>(
      '/layout/revisions/save',
      { projectId, expectedWorkingVersion },
      isLayoutWorkingState,
    ),
  restoreRevision: (projectId: string, revisionId: string, expectedWorkingVersion: number) =>
    request<LayoutWorkingState>(
      '/layout/revisions/restore',
      { projectId, revisionId, expectedWorkingVersion },
      isLayoutWorkingState,
    ),
  listRevisions: (projectId: string) =>
    request<LayoutRevisionHistory>(
      '/layout/revisions/list',
      { projectId },
      isLayoutRevisionHistory,
    ),
  getRevision: (projectId: string, revisionId: string) =>
    request<LayoutRevisionSnapshot>(
      '/layout/revisions/get',
      { projectId, revisionId },
      isLayoutRevisionSnapshot,
    ),
  applyState: (projectId: string) =>
    request<LayoutApplyState>('/layout/apply-state/get', { projectId }, isLayoutApplyState),
  apply: (
    projectId: string,
    expectedRevisionId: string,
    expectedWorkingVersion: number,
    clientRequestId: string,
  ) =>
    request<LayoutApplyResult>(
      '/layout/apply',
      { projectId, expectedRevisionId, expectedWorkingVersion, clientRequestId },
      isLayoutApplyResult,
    ),
};
