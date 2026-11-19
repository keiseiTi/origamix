export interface ProjectExportFile {
  path: string;
  text: string;
  sha256: string;
}

export interface ProjectExportSnapshot {
  projectId: string;
  code: string;
  template: { version: string; sha256: string };
  files: ProjectExportFile[];
}
