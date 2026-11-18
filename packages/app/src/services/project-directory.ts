import type { ProjectSyncReceipt } from '@origamix/shared';

interface ReadWritePermission {
  mode: 'readwrite';
}

export type ProjectDirectory = FileSystemDirectoryHandle & {
  queryPermission(options: ReadWritePermission): Promise<PermissionState>;
  requestPermission(options: ReadWritePermission): Promise<PermissionState>;
  values(): AsyncIterableIterator<FileSystemHandle>;
};

const filesystemWindow = () =>
  window as Window & {
    showDirectoryPicker?: (options: ReadWritePermission) => Promise<ProjectDirectory>;
  };

export const supportsProjectDirectory = () =>
  window.isSecureContext && Boolean(filesystemWindow().showDirectoryPicker && navigator.locks);

export const pickProjectParent = () =>
  filesystemWindow().showDirectoryPicker!({ mode: 'readwrite' });
export const requestProjectDirectoryAccess = (handle: ProjectDirectory) =>
  handle.requestPermission({ mode: 'readwrite' });
export const hasProjectDirectoryAccess = async (handle: ProjectDirectory) =>
  (await handle.queryPermission({ mode: 'readwrite' })) === 'granted';

export interface ProjectDirectoryBinding {
  projectId: string;
  targetId: string;
  code: string;
  parent: ProjectDirectory;
  receipt?: ProjectSyncReceipt;
  awaitingReceipt?: string;
  creating?: { snapshotId: string; path: string };
  bootstrapTemplate?: { sha256: string; bytes: ArrayBuffer };
}

const databaseName = 'origamix-project-directories';
const storeName = 'bindings';

const withBindings = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open(databaseName, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(storeName, { keyPath: 'projectId' });
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = action(transaction.objectStore(storeName));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () =>
        reject(transaction.error ?? request.error ?? new Error('无法保存目录授权'));
    });
  } finally {
    database.close();
  }
};

export const readProjectDirectory = (
  projectId: string,
): Promise<ProjectDirectoryBinding | undefined> =>
  withBindings('readonly', (store) => store.get(projectId));

export const saveProjectDirectory = async (binding: ProjectDirectoryBinding) => {
  await withBindings('readwrite', (store) => store.put(binding));
};
