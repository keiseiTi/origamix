import { lstat, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { invalid } from '../errors';

/** Fixed, caller-selected segments only. Reject symlinks in every existing component. */
export const projectFilePath = async (
  projectPath: string,
  ...segments: string[]
): Promise<string> => {
  let path = await realpath(projectPath);
  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..' || /[/\\\0]/.test(segment))
      throw invalid('项目文件路径无效');
    path = join(path, segment);
    try {
      if ((await lstat(path)).isSymbolicLink()) throw invalid('项目文件路径不能是符号链接');
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }
  return path;
};
