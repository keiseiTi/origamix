import {
  type ProjectExportSnapshot,
  type ProjectSyncReceipt,
  type ProjectSyncSnapshot,
} from '@origamix/shared';
import { nanoid } from 'nanoid';
import {
  hasProjectDirectoryAccess,
  readProjectDirectory,
  saveProjectDirectory,
  type ProjectDirectory,
  type ProjectDirectoryBinding,
} from './project-directory';
import { request } from './request';
import { observeWebSession } from './web-session';

const encoder = new TextEncoder();
const encode = (text: string) => encoder.encode(text);

const marker = '.origamix-sync.json';
const emptySha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const manifestFile = 'origamix.project.json';
const sha256 = async (data: BufferSource) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');

const pathParts = (path: string) => {
  const parts = path.split('/');
  if (parts.some((part) => !/^[A-Za-z0-9._-]+$/.test(part) || part === '.' || part === '..'))
    throw new Error(`项目文件路径无效：${path}`);
  return parts;
};

const missing = (error: unknown) => error instanceof DOMException && error.name === 'NotFoundError';

const locateFile = async (root: FileSystemDirectoryHandle, path: string, create = false) => {
  const segments = pathParts(path);
  const name = segments.pop()!;
  let parent = root;
  for (const part of segments) parent = await parent.getDirectoryHandle(part, { create });
  return { parent, name };
};

const readLocal = async (
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<File | undefined> => {
  try {
    const { parent, name } = await locateFile(root, path);
    return await (await parent.getFileHandle(name)).getFile();
  } catch (error) {
    if (missing(error)) return undefined;
    throw error;
  }
};

const localHash = async (root: FileSystemDirectoryHandle, path: string) => {
  const file = await readLocal(root, path);
  return file ? sha256(await file.arrayBuffer()) : undefined;
};

const writeLocal = async (
  root: FileSystemDirectoryHandle,
  path: string,
  data: Uint8Array<ArrayBuffer>,
) => {
  const { parent, name } = await locateFile(root, path, true);
  const handle = await parent.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  try {
    await writable.write(data);
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => undefined);
    throw error;
  }
};

const childDirectory = async (parent: ProjectDirectory, code: string) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code)) throw new Error('项目目录名称无效');
  try {
    return (await parent.getDirectoryHandle(code)) as ProjectDirectory;
  } catch (error) {
    if (missing(error)) return undefined;
    throw error;
  }
};

const readTarget = async (root: FileSystemDirectoryHandle, recoverMarker = false) => {
  const metadata = await readLocal(root, marker);
  if (!metadata || (recoverMarker && metadata.size === 0)) return undefined;
  try {
    const value = JSON.parse(await metadata.text()) as { projectId?: string; targetId?: string };
    if (
      typeof value.projectId === 'string' &&
      /^target_[A-Za-z0-9_-]{16,48}$/.test(value.targetId ?? '')
    )
      return { projectId: value.projectId, targetId: value.targetId! };
  } catch {
    // An invalid marker may belong to another process and must be left untouched.
  }
  throw new Error('本地项目的同步标识无法读取');
};

const confirmEmpty = async (root: ProjectDirectory, recoverMarker = false) => {
  for await (const entry of root.values()) {
    if (recoverMarker && entry.kind === 'file' && entry.name === marker) continue;
    throw new Error('同名目录已有文件。请选择其他父目录，或选择此项目原来的同步目录。');
  }
};

const withProjectLock = <T>(id: string, action: () => Promise<T>) =>
  navigator.locks.request(`origamix-project-sync:${id}`, action);

export const bindProjectParent = (projectId: string, parent: ProjectDirectory) =>
  withProjectLock(projectId, async () => {
    const { code } = await request<{ code: string }>('/projects/sync/identity', { projectId });
    const prior = await readProjectDirectory(projectId);
    const sameParent = prior ? await parent.isSameEntry(prior.parent) : false;
    const recoveringMarker = sameParent && prior?.creating?.path === marker;
    const existing = await childDirectory(parent, code);
    const match = existing && (await readTarget(existing, recoveringMarker));
    if (match && match.projectId !== projectId) throw new Error('此目录绑定了其他项目');
    if (existing && !match) await confirmEmpty(existing, recoveringMarker);
    const targetId =
      match?.targetId ??
      (sameParent && !prior?.receipt ? prior?.targetId : undefined) ??
      `target_${nanoid()}`;
    const binding: ProjectDirectoryBinding = {
      ...(sameParent && prior?.targetId === targetId ? prior : {}),
      projectId,
      targetId,
      code,
      parent,
    };
    await saveProjectDirectory(binding);
    return binding;
  });

const targetRoot = async (
  binding: ProjectDirectoryBinding,
  snapshot: ProjectSyncSnapshot,
  beforeCreate: (path: string) => Promise<void>,
) => {
  const found = await childDirectory(binding.parent, snapshot.code);
  const root =
    found ??
    (snapshot.bootstrap
      ? ((await binding.parent.getDirectoryHandle(snapshot.code, {
          create: true,
        })) as ProjectDirectory)
      : undefined);
  if (!root) throw new Error('同步目录已移走。请重新选择项目父目录。');
  const recoverMarker =
    binding.creating?.snapshotId === snapshot.id && binding.creating.path === marker;
  const target = await readTarget(root, recoverMarker);
  if (!target && snapshot.bootstrap) {
    await confirmEmpty(root, recoverMarker);
    await beforeCreate(marker);
    await writeLocal(
      root,
      marker,
      encode(
        JSON.stringify({
          projectId: binding.projectId,
          targetId: binding.targetId,
        }),
      ),
    );
  } else if (target?.projectId !== binding.projectId || target.targetId !== binding.targetId) {
    throw new Error('本地目录与当前项目的绑定不匹配');
  }
  return root;
};

const downloadTemplate = async (template: ProjectExportSnapshot['template']) => {
  const response = await fetch(
    `/api/v1/templates/${encodeURIComponent(template.version)}/download`,
    {
      cache: 'no-store',
    },
  );
  observeWebSession(response);
  if (!response.ok)
    throw new Error(response.status === 401 ? '请重新登录后同步' : '模板下载失败，请重试');
  const bytes = await response.arrayBuffer();
  if ((await sha256(bytes)) !== template.sha256)
    throw new Error('模板版本或校验值已变化，请重新绑定其他空目录后重试。');
  return bytes;
};

const templateFiles = async (bytes: ArrayBuffer, code: string) => {
  const { unzipSync, strFromU8 } = await import('fflate');
  const entries = Object.entries(unzipSync(new Uint8Array(bytes)));
  const files = new Map<string, Uint8Array<ArrayBuffer>>();
  for (const [path, contents] of entries) {
    if (path.endsWith('/') || path === manifestFile) continue;
    pathParts(path);
    if (path === marker) throw new Error('模板包含用于同步的保留文件');
    files.set(path, new Uint8Array(contents));
  }
  const manifest = files.get('package.json');
  if (!manifest || !files.has('index.html')) throw new Error('模板缺少项目入口');
  const pkg = JSON.parse(strFromU8(manifest));
  files.set('package.json', encode(`${JSON.stringify({ ...pkg, name: code }, null, 2)}\n`));
  return files;
};

const conflictMessage = (path: string) =>
  new Error(`本地文件已变化：${path}。请恢复上次同步的内容后重试。`);
type FileChange = {
  path: string;
  desired: string | undefined;
  prior: string | undefined;
  bytes?: Uint8Array<ArrayBuffer>;
};

const inspectChange = async (
  root: FileSystemDirectoryHandle,
  change: FileChange,
  reached: boolean,
  interrupted: boolean,
) => {
  const actual = await localHash(root, change.path);
  if (actual === change.prior) return actual;
  if (actual === change.desired && (change.prior !== undefined || reached)) return actual;
  // Only the journaled creation can leave an empty placeholder before the stream closes.
  if (change.bytes && change.prior === undefined && interrupted && actual === emptySha256)
    return actual;
  throw conflictMessage(change.path);
};

const updateFiles = async (
  root: FileSystemDirectoryHandle,
  changes: FileChange[],
  creatingPath: string | undefined,
  beforeCreate: (path: string) => Promise<void>,
) => {
  const checkpoint = creatingPath ? changes.findIndex(({ path }) => path === creatingPath) : -1;
  const inspect = (change: FileChange, index: number) =>
    inspectChange(root, change, index <= checkpoint, index === checkpoint);
  for (const [index, change] of changes.entries()) await inspect(change, index);
  for (const [index, change] of changes.entries()) {
    const actual = await inspect(change, index);
    if (actual === change.desired) continue;
    if (change.bytes) {
      if (actual === undefined) await beforeCreate(change.path);
      await writeLocal(root, change.path, change.bytes);
    } else {
      const { parent, name } = await locateFile(root, change.path);
      await parent.removeEntry(name);
    }
  }
  for (const change of changes)
    if ((await localHash(root, change.path)) !== change.desired) throw conflictMessage(change.path);
};

const finish = async (binding: ProjectDirectoryBinding, snapshotId: string) => {
  const receipt = await request<ProjectSyncReceipt>('/projects/sync/finish', {
    projectId: binding.projectId,
    targetId: binding.targetId,
    snapshotId,
  });
  await saveProjectDirectory({
    projectId: binding.projectId,
    targetId: binding.targetId,
    code: binding.code,
    parent: binding.parent,
    receipt,
  });
  return receipt;
};

export const syncProjectToDirectory = (projectId: string) =>
  withProjectLock(projectId, async () => {
    const priorBinding = await readProjectDirectory(projectId);
    if (!priorBinding) throw new Error('请先选择项目父目录');
    let binding = priorBinding;
    if (binding.awaitingReceipt) return finish(binding, binding.awaitingReceipt);
    if (!(await hasProjectDirectoryAccess(binding.parent)))
      throw new Error('目录写入权限已失效，请重新授权。');

    const snapshot = await request<ProjectSyncSnapshot>('/projects/sync/prepare', {
      projectId,
      targetId: binding.targetId,
    });
    if (snapshot.projectId !== projectId) throw new Error('同步快照不属于当前项目');
    const changes: FileChange[] = [];
    if (snapshot.bootstrap) {
      const bytes =
        binding.bootstrapTemplate?.sha256 === snapshot.template.sha256
          ? binding.bootstrapTemplate.bytes
          : await downloadTemplate(snapshot.template);
      binding = { ...binding, bootstrapTemplate: { sha256: snapshot.template.sha256, bytes } };
      await saveProjectDirectory(binding);
      for (const [path, contents] of await templateFiles(bytes, snapshot.code))
        changes.push({ path, desired: await sha256(contents), prior: undefined, bytes: contents });
    }
    const paths = new Set(changes.map(({ path }) => path));
    for (const file of snapshot.files) {
      if (paths.has(file.path) || file.path === marker)
        throw new Error(`同步路径冲突：${file.path}`);
      paths.add(file.path);
      const bytes = encode(file.text);
      if ((await sha256(bytes)) !== file.sha256) throw new Error(`同步文件校验失败：${file.path}`);
      changes.push({
        path: file.path,
        desired: file.sha256,
        prior: snapshot.previous[file.path],
        bytes,
      });
    }
    for (const file of snapshot.removals) {
      if (paths.has(file.path) || file.path === marker)
        throw new Error(`同步路径冲突：${file.path}`);
      changes.push({ path: file.path, desired: undefined, prior: file.sha256 });
    }
    const beforeCreate = async (path: string) => {
      binding = { ...binding, creating: { snapshotId: snapshot.id, path } };
      await saveProjectDirectory(binding);
    };
    const root = await targetRoot(binding, snapshot, beforeCreate);
    const creatingPath =
      binding.creating?.snapshotId === snapshot.id ? binding.creating.path : undefined;
    await updateFiles(root, changes, creatingPath, beforeCreate);
    const currentRoot = await childDirectory(binding.parent, snapshot.code);
    const target = currentRoot && (await readTarget(currentRoot));
    if (
      !currentRoot ||
      !(await root.isSameEntry(currentRoot)) ||
      target?.projectId !== projectId ||
      target.targetId !== binding.targetId
    )
      throw new Error('项目目录在同步期间发生变化，尚未记录同步完成。');
    await saveProjectDirectory({ ...binding, awaitingReceipt: snapshot.id });
    return finish(binding, snapshot.id);
  });

export const downloadProjectZip = async (projectId: string) => {
  const snapshot = await request<ProjectExportSnapshot>('/projects/export/snapshot', { projectId });
  if (snapshot.projectId !== projectId) throw new Error('导出快照不属于当前项目');
  const files = await templateFiles(await downloadTemplate(snapshot.template), snapshot.code);
  for (const file of snapshot.files) {
    pathParts(file.path);
    if (files.has(file.path) || file.path === marker) throw new Error(`导出路径冲突：${file.path}`);
    const bytes = encode(file.text);
    if ((await sha256(bytes)) !== file.sha256) throw new Error(`导出文件校验失败：${file.path}`);
    files.set(file.path, bytes);
  }
  const { zipSync } = await import('fflate');
  const zipped = zipSync(Object.fromEntries(files));
  const url = URL.createObjectURL(new Blob([new Uint8Array(zipped)], { type: 'application/zip' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${snapshot.code}.zip`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
