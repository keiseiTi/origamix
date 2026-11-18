export interface ProjectSyncFile {
  path: string;
  text: string;
  sha256: string;
}

export interface ProjectSyncRemoval {
  path: string;
  sha256: string;
}

export interface ProjectExportSnapshot {
  projectId: string;
  code: string;
  template: { version: string; sha256: string };
  files: ProjectSyncFile[];
}

export interface ProjectSyncSnapshot extends ProjectExportSnapshot {
  id: string;
  bootstrap: boolean;
  previous: Record<string, string>;
  removals: ProjectSyncRemoval[];
}

export interface ProjectSyncReceipt {
  snapshotId: string;
  completedAt: string;
}
