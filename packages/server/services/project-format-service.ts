import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { nanoid } from 'nanoid';
import {
  isProjectManifest,
  type ProjectManifest,
  type ProjectPageManifest,
} from '@origamix/shared/protocol/project-manifest';
import { invalid, notFound } from '../errors';

export type ProjectPageItem = ProjectPageManifest;

const atomicWrite = async (path: string, contents: string): Promise<void> => {
  const temporary = `${path}.${nanoid()}.tmp`;
  await writeFile(temporary, contents, { mode: 0o600 });
  await rename(temporary, path);
};

export class ProjectFormatService {
  async writeManifest(projectPath: string, manifest: ProjectManifest): Promise<void> {
    await atomicWrite(
      join(projectPath, 'origamix.project.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  }

  async initializeManifest(
    projectPath: string,
    input: Pick<ProjectManifest, 'projectId' | 'name'>,
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
    if (!isProjectManifest(manifest)) throw invalid('项目清单字段无效或不受支持');
    const ids = new Set<string>();
    const slugs = new Set<string>();
    const routes = new Set<string>();
    for (const page of manifest.pages) {
      if (
        !/^page_[A-Za-z0-9_-]+$/.test(page.pageId) ||
        !page.name ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug) ||
        !/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/.test(page.route) ||
        ids.has(page.pageId) ||
        slugs.has(page.slug) ||
        routes.has(page.route)
      )
        throw invalid('项目页面清单存在无效或重复的页面');
      ids.add(page.pageId);
      slugs.add(page.slug);
      routes.add(page.route);
    }
    return manifest;
  }

  async readPages(projectPath: string): Promise<ProjectPageItem[]> {
    return (await this.readManifest(projectPath)).pages;
  }

  async addPage(projectPath: string, page: ProjectPageItem): Promise<void> {
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
}
