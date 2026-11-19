import { createHash } from 'node:crypto';
import {
  resolveProjectStack,
  type ProjectManifest,
  type ProjectExportSnapshot,
  type ProjectSyncFile,
} from '@origamix/shared';
import { conflict, invalid } from '../errors';
import type { WorkingSchemaReadResult } from '../schema/schema-contracts';
import { pageComponentSource } from './project-source';

const file = (path: string, text: string): ProjectSyncFile => ({
  path,
  text,
  sha256: createHash('sha256').update(text).digest('hex'),
});

export const buildProjectSnapshot = async (
  manifest: ProjectManifest,
  template: ProjectExportSnapshot['template'],
  readPage: (pageId: string) => Promise<WorkingSchemaReadResult>,
): Promise<ProjectExportSnapshot> => {
  const code = manifest.code;
  if (!code) throw invalid('项目标识缺失');
  const files: ProjectSyncFile[] = [];
  const unsaved: string[] = [];
  const stack = resolveProjectStack(manifest);
  for (const page of manifest.pages) {
    const working = await readPage(page.pageId);
    if (working.workingHash !== working.savedSchemaHash) {
      unsaved.push(page.name);
      continue;
    }
    const directory = `src/${manifest.pageDirectory}/${page.slug}`;
    files.push(
      file(`${directory}/index.tsx`, pageComponentSource(page.slug, stack)),
      file(`${directory}/schema.json`, `${JSON.stringify(working.schema, null, 2)}\n`),
    );
  }
  if (unsaved.length) throw conflict(`请先保存页面版本：${unsaved.join('、')}`);
  files.push(
    file('origamix.project.json', `${JSON.stringify({ ...manifest, product: 'web' }, null, 2)}\n`),
  );
  return { projectId: manifest.projectId, code, template, files };
};
