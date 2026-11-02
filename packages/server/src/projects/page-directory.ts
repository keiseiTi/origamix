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
  return resolvePageDirectory(projectPath, pageDirectory, undefined, true);
};

/** Check every directory, including src and the page leaf, before destructive access. */
export const resolvePageDirectory = async (
  projectPath: string,
  pageDirectory: string,
  slug?: string,
  create = false,
): Promise<string> => {
  const project = await realpath(projectPath);
  if (slug !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw invalid('页面标识无效');
  let directory = project;
  let missing = false;
  const segments = [
    'src',
    ...normalizePageDirectory(pageDirectory).split('/'),
    ...(slug ? [slug] : []),
  ];
  for (const segment of segments) {
    const candidate = join(directory, segment);
    if (missing) {
      directory = candidate;
      continue;
    }
    try {
      const entry = await lstat(candidate);
      if (entry.isSymbolicLink()) throw invalid('页面目录不能是符号链接');
      if (!entry.isDirectory()) throw invalid('页面目录不是文件夹');
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      if (create) await mkdir(candidate);
      else {
        missing = true;
        directory = candidate;
        continue;
      }
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
