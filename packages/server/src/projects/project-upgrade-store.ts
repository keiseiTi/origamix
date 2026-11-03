import { readFile, lstat, realpath, mkdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { metadataPath } from '../schema/metadata-path';
import { writeJsonAtomically } from '../infrastructure/atomic-file';
import { conflict, invalid } from '../errors';

export interface ProjectUpgradeJournal {
  version: 1;
  requestId: string;
  projectId: string;
  from: string;
  to: string;
  state: 'pending' | 'completed';
  packageSource: string;
  manifestSource: string;
  pages: Array<{
    pageId: string;
    revisionId: string;
    workingVersion: number;
    schemaHash: string;
    targetHash: string;
  }>;
}

export const readProjectUpgrade = async (
  projectPath: string,
): Promise<ProjectUpgradeJournal | undefined> => {
  try {
    const value = JSON.parse(
      await readFile(await metadataPath(projectPath, 'project-upgrade.json'), 'utf8'),
    ) as ProjectUpgradeJournal;
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      value.version !== 1 ||
      !/^[A-Za-z0-9_-]{1,40}$/.test(value.requestId) ||
      typeof value.projectId !== 'string' ||
      typeof value.from !== 'string' ||
      typeof value.to !== 'string' ||
      !['pending', 'completed'].includes(value.state) ||
      typeof value.packageSource !== 'string' ||
      typeof value.manifestSource !== 'string' ||
      !Array.isArray(value.pages) ||
      value.pages.some(
        (page) =>
          !page ||
          !/^page_[A-Za-z0-9_-]+$/.test(page.pageId) ||
          !/^revision_[A-Za-z0-9_-]+$/.test(page.revisionId) ||
          !Number.isSafeInteger(page.workingVersion) ||
          page.workingVersion < 1 ||
          !/^[a-f0-9]{64}$/.test(page.schemaHash) ||
          !/^[a-f0-9]{64}$/.test(page.targetHash),
      )
    )
      throw invalid('项目升级记录无效');
    return value;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  }
};

export const writeProjectUpgrade = async (
  projectPath: string,
  journal: ProjectUpgradeJournal,
): Promise<void> => {
  const path = await metadataPath(projectPath, 'project-upgrade.json');
  await mkdir(dirname(path), { recursive: true });
  await writeJsonAtomically(path, journal);
};

export const assertProjectNotUpgrading = async (projectPath: string): Promise<void> => {
  if ((await readProjectUpgrade(projectPath))?.state === 'pending')
    throw conflict('项目旧版升级尚未完成，请使用原应用恢复或检查是否可安全撤销；草稿已保留');
};

/** Only fixed project configuration files are used by the upgrade service. */
export const upgradeFilePath = async (
  projectPath: string,
  ...segments: string[]
): Promise<string> => {
  let path = await realpath(projectPath);
  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..' || /[/\\\0]/.test(segment))
      throw invalid('升级文件路径无效');
    path = join(path, segment);
    try {
      if ((await lstat(path)).isSymbolicLink()) throw invalid('升级文件不能是符号链接');
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }
  return path;
};

export const removeProjectUpgrade = async (projectPath: string): Promise<void> => {
  await rm(await metadataPath(projectPath, 'project-upgrade.json'));
};
