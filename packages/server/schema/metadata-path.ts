import { lstat, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { invalid } from '../errors';

/** Resolve only ordinary entries below the authorized project's metadata directory. */
export const metadataPath = async (projectPath: string, ...segments: string[]): Promise<string> => {
  if (
    segments.some(
      (segment) => !segment || segment === '.' || segment === '..' || /[/\\\0]/.test(segment),
    )
  )
    throw invalid('项目内部数据路径无效');
  let path = await realpath(projectPath);
  let missing = false;
  for (const segment of ['.origamix', ...segments]) {
    path = join(path, segment);
    if (missing) continue;
    try {
      if ((await lstat(path)).isSymbolicLink()) throw invalid('项目内部数据路径不能是符号链接');
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      missing = true;
    }
  }
  return path;
};
