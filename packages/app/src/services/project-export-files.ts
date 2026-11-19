import type { ProjectExportSnapshot } from '@origamix/shared';

const encoder = new TextEncoder();
export const encode = (text: string) => encoder.encode(text);

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
    files.set(path, new Uint8Array(contents));
  }
  const manifest = files.get('package.json');
  if (!manifest || !files.has('index.html')) throw new Error('模板缺少项目入口');
  const pkg = JSON.parse(strFromU8(manifest));
  files.set('package.json', encode(`${JSON.stringify({ ...pkg, name: code }, null, 2)}\n`));
  return files;
};

type ProjectFiles = Map<string, Uint8Array<ArrayBuffer>>;

export const projectFiles = async (
  files: ProjectExportSnapshot['files'],
  template: ProjectFiles,
): Promise<ProjectFiles> => {
  const result = new Map(template);
  for (const file of files) {
    pathParts(file.path);
    if (result.has(file.path)) throw new Error(`导出路径冲突：${file.path}`);
    const bytes = encode(file.text);
    if ((await sha256(bytes)) !== file.sha256) throw new Error(`导出文件校验失败：${file.path}`);
    result.set(file.path, bytes);
  }
  return result;
};
