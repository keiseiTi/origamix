import { lstat, mkdir, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
import { invalid } from '../errors';

export const normalizePageDirectory = (value = 'pages'): string => {
  const pageDirectory = value.trim();
  if (!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(pageDirectory))
    throw invalid('页面目录必须是 src 下的相对路径');
  return pageDirectory;
};
export const ensurePageDirectory = async (
  projectPath: string,
  pageDirectory: string,
): Promise<string> => {
  const project = await realpath(projectPath);
  let directory = join(project, 'src');
  await mkdir(directory, { recursive: true });
  for (const segment of pageDirectory.split('/')) {
    const candidate = join(directory, segment);
    try {
      if ((await lstat(candidate)).isSymbolicLink()) throw invalid('页面目录不能是符号链接');
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      await mkdir(candidate);
    }
    const resolved = await realpath(candidate);
    const fromProject = relative(project, resolved);
    if (
      fromProject === '..' ||
      fromProject.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
      isAbsolute(fromProject)
    )
      throw invalid('页面目录不属于当前项目');
    directory = resolved;
  }
  return directory;
};
