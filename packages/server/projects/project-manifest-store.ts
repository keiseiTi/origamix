import { assertProjectNotUpgrading } from './project-upgrade-store';
import { writeFileAtomically } from '../infrastructure/atomic-file';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  isProjectManifest,
  type ProjectManifest,
  type ProjectPageManifest,
  BUILTIN_PROJECT_STACK,
  resolveProjectStack,
} from '@origamix/shared';

import { invalid, notFound } from '../errors';

export class ProjectManifestStore {
  async writeManifest(projectPath: string, manifest: ProjectManifest): Promise<void> {
    await assertProjectNotUpgrading(projectPath);
    await writeFileAtomically(
      join(projectPath, 'origamix.project.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  }

  async initializeManifest(
    projectPath: string,
    input: Pick<ProjectManifest, 'projectId' | 'name' | 'pageDirectory'> & { code: string },
  ): Promise<void> {
    await this.writeManifest(projectPath, {
      ...input,
      framework: BUILTIN_PROJECT_STACK.framework,
      uiLibrary: BUILTIN_PROJECT_STACK.uiLibrary,
      version: BUILTIN_PROJECT_STACK.materialSet.version,
      materialSet: BUILTIN_PROJECT_STACK.materialSet.id,
      pages: [],
    });
  }

  async readManifest(projectPath: string): Promise<ProjectManifest> {
    try {
      return this.parseManifest(await readFile(join(projectPath, 'origamix.project.json'), 'utf8'));
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        throw invalid('目录尚未初始化为 Origamix 项目');
      throw error;
    }
  }

  parseManifest(source: string): ProjectManifest {
    let manifest: unknown;
    try {
      manifest = JSON.parse(source);
    } catch {
      throw invalid('项目清单不是有效的 JSON');
    }
    if (!isProjectManifest(manifest)) throw invalid('项目清单字段无效或不受支持');
    this.resolveStack(manifest);
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

  private resolveStack(descriptor: unknown) {
    try {
      return resolveProjectStack(descriptor);
    } catch (reason) {
      throw invalid(reason instanceof Error ? reason.message : '项目技术栈配置无效');
    }
  }

  async readStack(projectPath: string) {
    return this.resolveStack(await this.readManifest(projectPath));
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
