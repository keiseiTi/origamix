import type { ProjectExportSnapshot, ProjectSyncSnapshot } from '@origamix/shared';

const encoder = new TextEncoder();
export const encode = (text: string) => encoder.encode(text);

export const syncMarker = '.origamix-sync.json';
const manifestFile = 'origamix.project.json';
export const sha256 = async (data: BufferSource) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');

export const pathParts = (path: string) => {
  const parts = path.split('/');
  if (parts.some((part) => !/^[A-Za-z0-9._-]+$/.test(part) || part === '.' || part === '..'))
    throw new Error(`项目文件路径无效：${path}`);
  return parts;
};

export const templateFiles = async (bytes: ArrayBuffer, code: string) => {
  const { unzipSync, strFromU8 } = await import('fflate');
  const entries = Object.entries(unzipSync(new Uint8Array(bytes)));
  const files = new Map<string, Uint8Array<ArrayBuffer>>();
  for (const [path, contents] of entries) {
    if (path.endsWith('/') || path === manifestFile) continue;
    pathParts(path);
    if (path === syncMarker) throw new Error('模板包含用于同步的保留文件');
    files.set(path, new Uint8Array(contents));
  }
  const manifest = files.get('package.json');
  if (!manifest || !files.has('index.html')) throw new Error('模板缺少项目入口');
  const pkg = JSON.parse(strFromU8(manifest));
  files.set('package.json', encode(`${JSON.stringify({ ...pkg, name: code }, null, 2)}\n`));
  return files;
};

export type FileChange = {
  path: string;
  desired: string | undefined;
  prior: string | undefined;
  bytes?: Uint8Array<ArrayBuffer>;
};

type ProjectFiles = Map<string, Uint8Array<ArrayBuffer>>;

const requireUnusedPath = (path: string, used: { has(path: string): boolean }, action: string) => {
  pathParts(path);
  if (used.has(path) || path === syncMarker) throw new Error(`${action}路径冲突：${path}`);
};

export const projectFiles = async (
  files: ProjectExportSnapshot['files'],
  template: ProjectFiles,
  action: '同步' | '导出',
): Promise<ProjectFiles> => {
  const result = new Map(template);
  for (const file of files) {
    requireUnusedPath(file.path, result, action);
    const bytes = encode(file.text);
    if ((await sha256(bytes)) !== file.sha256)
      throw new Error(`${action}文件校验失败：${file.path}`);
    result.set(file.path, bytes);
  }
  return result;
};

export const planSyncChanges = async (
  snapshot: ProjectSyncSnapshot,
  template = new Map<string, Uint8Array<ArrayBuffer>>(),
): Promise<FileChange[]> => {
  const files = await projectFiles(snapshot.files, template, '同步');
  const hashes = new Map(snapshot.files.map(({ path, sha256 }) => [path, sha256]));
  const changes: FileChange[] = [];
  for (const [path, bytes] of files) {
    const desired = hashes.get(path);
    changes.push({
      path,
      desired: desired ?? (await sha256(bytes)),
      prior: desired === undefined ? undefined : snapshot.previous[path],
      bytes,
    });
  }
  const usedPaths = new Set(files.keys());
  for (const file of snapshot.removals) {
    requireUnusedPath(file.path, usedPaths, '同步');
    usedPaths.add(file.path);
    changes.push({ path: file.path, desired: undefined, prior: file.sha256 });
  }
  return changes;
};
