import type { ProjectExportSnapshot } from '@origamix/shared';
import { request } from './request';
import { observeWebSession } from './web-session';
import { projectFiles, sha256, templateFiles } from './project-export-files';

const downloadTemplate = async (template: ProjectExportSnapshot['template']) => {
  const response = await fetch(
    `/api/v1/templates/${encodeURIComponent(template.version)}/download`,
    {
      cache: 'no-store',
    },
  );
  observeWebSession(response);
  if (!response.ok)
    throw new Error(response.status === 401 ? '请重新登录后导出' : '模板下载失败，请重试');
  const bytes = await response.arrayBuffer();
  if ((await sha256(bytes)) !== template.sha256)
    throw new Error('模板校验失败，请刷新后重新导出。');
  return bytes;
};

export const downloadProjectZip = async (projectId: string) => {
  const snapshot = await request<ProjectExportSnapshot>('/projects/export/snapshot', { projectId });
  if (snapshot.projectId !== projectId) throw new Error('导出快照不属于当前项目');
  const template = await templateFiles(await downloadTemplate(snapshot.template), snapshot.code);
  const files = await projectFiles(snapshot.files, template);
  const { zipSync } = await import('fflate');
  const zipped = zipSync(Object.fromEntries(files));
  const url = URL.createObjectURL(new Blob([new Uint8Array(zipped)], { type: 'application/zip' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${snapshot.code}.zip`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
