import { nanoid } from 'nanoid';
import { isPagePreviewSnapshot, type PagePreviewSnapshot } from '@origamix/shared';
import { projectsService } from '@/services/projects';
import { schemaService } from '@/services/schema';

export const loadPagePreviewSnapshot = async (
  projectId: string,
  pageId: string,
  theme: 'light' | 'dark',
): Promise<PagePreviewSnapshot> => {
  const [working, stack] = await Promise.all([
    schemaService.workingState(projectId, pageId),
    projectsService.stack(projectId),
  ]);
  const snapshot = {
    snapshotId: nanoid(),
    pageId,
    stack,
    theme,
    schema: working.schema,
    hash: working.workingHash,
    workingVersion: working.workingVersion,
    revisionId: working.revisionId,
  };
  if (!isPagePreviewSnapshot(snapshot)) throw new Error('页面预览数据无效，请重试');
  return snapshot;
};
