import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { nanoid } from 'nanoid';
import { invalid, notFound } from '../errors';

export interface ProjectManifest {
  projectId: string;
  name: string;
  framework: 'react';
  uiLibrary: 'antd';
  pages: ProjectPageItem[];
}

export interface ProjectPageItem {
  pageId: string;
  name: string;
  slug: string;
  route: string;
}

async function atomicWrite(path: string, contents: string): Promise<void> {
  const temporary = `${path}.${nanoid()}.tmp`;
  await writeFile(temporary, contents, { mode: 0o600 });
  await rename(temporary, path);
}

export class ProjectFormatService {
  async readManifest(projectPath: string): Promise<ProjectManifest> {
    let manifest: ProjectManifest;
    try {
      manifest = JSON.parse(
        await readFile(join(projectPath, 'origamix.project.json'), 'utf8'),
      ) as ProjectManifest;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        throw invalid('目录尚未初始化为 Origamix 项目');
      throw error;
    }
    if (!manifest.projectId || !manifest.name) throw invalid('项目清单无效');
    if (manifest.framework !== 'react' || manifest.uiLibrary !== 'antd')
      throw invalid('MVP 仅支持 React + Ant Design 项目');
    if (!Array.isArray(manifest.pages)) throw invalid('项目页面清单无效');
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

  async renameProject(projectPath: string, name: string): Promise<void> {
    const manifest = await this.readManifest(projectPath);
    await atomicWrite(
      join(projectPath, 'origamix.project.json'),
      `${JSON.stringify({ ...manifest, name }, null, 2)}\n`,
    );
  }

  async renamePage(projectPath: string, pageId: string, name: string): Promise<void> {
    const manifest = await this.readManifest(projectPath);
    const pages = manifest.pages.map((item) => (item.pageId === pageId ? { ...item, name } : item));
    if (!pages.some((item) => item.pageId === pageId)) throw notFound('页面注册信息不存在');
    await atomicWrite(
      join(projectPath, 'origamix.project.json'),
      `${JSON.stringify({ ...manifest, pages }, null, 2)}\n`,
    );
  }
}
