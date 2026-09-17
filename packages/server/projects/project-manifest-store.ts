import { writeFileAtomically } from '../infrastructure/atomic-file';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  isProjectManifest,
  type ProjectManifest,
  type ProjectPageManifest,
} from '@origamix/shared/protocol/project-manifest';
import { invalid, notFound } from '../errors';

export class ProjectManifestStore {
  async writeManifest(projectPath: string, manifest: ProjectManifest): Promise<void> {
    await writeFileAtomically(
      join(projectPath, 'origamix.project.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  }

  async initializeManifest(
    projectPath: string,
    input: Pick<ProjectManifest, 'projectId' | 'name' | 'pageDirectory'>,
  ): Promise<void> {
    await this.writeManifest(projectPath, {
      ...input,
      framework: 'react',
      uiLibrary: 'antd',
      pages: [],
    });
  }

  async readManifest(projectPath: string): Promise<ProjectManifest> {
    let manifest: unknown;
    try {
      manifest = JSON.parse(await readFile(join(projectPath, 'origamix.project.json'), 'utf8'));
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        throw invalid('目录尚未初始化为 Origamix 项目');
      throw invalid('项目清单不是有效的 JSON');
    }
    if (manifest && typeof manifest === 'object' && !('pageDirectory' in manifest)) {
      manifest = { ...manifest, pageDirectory: 'pages' };
    }
    if (!isProjectManifest(manifest)) throw invalid('项目清单字段无效或不受支持');
    const ids = new Set<string>();
    const slugs = new Set<string>();
    for (const page of manifest.pages) {
      if (ids.has(page.pageId) || slugs.has(page.slug))
        throw invalid('项目页面清单存在无效或重复的页面');
      ids.add(page.pageId);
      slugs.add(page.slug);
    }
    return manifest;
  }

  async readPages(projectPath: string): Promise<ProjectPageManifest[]> {
    return (await this.readManifest(projectPath)).pages;
  }

  async addPage(projectPath: string, page: ProjectPageManifest): Promise<void> {
    const manifest = await this.readManifest(projectPath);
    await this.writeManifest(projectPath, { ...manifest, pages: [...manifest.pages, page] });
  }

  async renameProject(projectPath: string, name: string): Promise<void> {
    const manifest = await this.readManifest(projectPath);
    await this.writeManifest(projectPath, { ...manifest, name });
  }

  async renamePage(projectPath: string, pageId: string, name: string): Promise<void> {
    const manifest = await this.readManifest(projectPath);
    const pages = manifest.pages.map((item) => (item.pageId === pageId ? { ...item, name } : item));
    if (!pages.some((item) => item.pageId === pageId)) throw notFound('页面注册信息不存在');
    await this.writeManifest(projectPath, { ...manifest, pages });
  }

  async removePage(projectPath: string, pageId: string): Promise<void> {
    const manifest = await this.readManifest(projectPath);
    const pages = manifest.pages.filter((item) => item.pageId !== pageId);
    if (pages.length === manifest.pages.length) throw notFound('页面注册信息不存在');
    await this.writeManifest(projectPath, { ...manifest, pages });
  }
}
