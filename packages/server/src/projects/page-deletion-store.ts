import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { metadataPath } from '../schema/metadata-path';
import { writeJsonAtomically } from '../infrastructure/atomic-file';
import { conflict, invalid } from '../errors';
import { normalizePageDirectory } from './page-directory';

export interface PageDeletion {
  version: 1;
  projectId: string;
  pageId: string;
  pageDirectory: string;
  slug: string;
  state: 'pending' | 'files_removed' | 'completed';
}

const deletionPath = (projectPath: string, pageId: string) => {
  if (!/^page_[A-Za-z0-9_-]+$/.test(pageId)) throw invalid('页面 ID 无效');
  return metadataPath(projectPath, 'page-deletions', `${pageId}.json`);
};

export const readPageDeletion = async (
  projectPath: string,
  pageId: string,
): Promise<PageDeletion | undefined> => {
  let value: PageDeletion;
  try {
    value = JSON.parse(
      await readFile(await deletionPath(projectPath, pageId), 'utf8'),
    ) as PageDeletion;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  }
  if (
    !value ||
    value.version !== 1 ||
    value.pageId !== pageId ||
    !/^project_[A-Za-z0-9_-]+$/.test(value.projectId) ||
    typeof value.pageDirectory !== 'string' ||
    typeof value.slug !== 'string' ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug) ||
    !['pending', 'files_removed', 'completed'].includes(value.state)
  )
    throw invalid('页面删除记录无效');
  normalizePageDirectory(value.pageDirectory);
  return value;
};

export const writePageDeletion = async (
  projectPath: string,
  value: PageDeletion,
): Promise<void> => {
  // Validate all cleanup destinations before the first destructive stage.
  for (const segments of [
    ['pages', value.pageId],
    ['revisions', value.pageId],
    ['transactions', `${value.pageId}.json`],
    ['apply-receipts', value.pageId],
  ])
    await metadataPath(projectPath, ...segments);
  const path = await deletionPath(projectPath, value.pageId);
  await mkdir(dirname(path), { recursive: true });
  await writeJsonAtomically(path, value);
};

export const assertPageNotDeleting = async (projectPath: string, pageId: string): Promise<void> => {
  if (await readPageDeletion(projectPath, pageId))
    throw conflict('页面已进入删除流程，请重试删除以完成清理');
};
