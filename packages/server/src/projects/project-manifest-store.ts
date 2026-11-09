import { writeFileAtomically } from '../infrastructure/atomic-file';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  isProjectManifest,
  type ProjectManifest,
  type ProjectPageManifest,
  type PageRoleId,
  BUILTIN_PROJECT_STACK,
  resolveProjectStack,
  validateResolvedProjectStack,
} from '@origamix/shared';

import { conflict, invalid, notFound } from '../errors';

export class ProjectManifestStore {
  async writeManifest(projectPath: string, manifest: ProjectManifest): Promise<void> {
    try {
      const source = await readFile(join(projectPath, 'origamix.project.json'), 'utf8');
      this.parseManifest(source);
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    await writeFileAtomically(
      join(projectPath, 'origamix.project.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  }

  async initializeManifest(
    projectPath: string,
    input: Pick<ProjectManifest, 'projectId' | 'name' | 'pageDirectory'> & {
      code: string;
      layout?: ProjectManifest['layout'];
      routing?: ProjectManifest['routing'];
    },
  ): Promise<void> {
    await this.writeManifest(projectPath, {
      ...input,
      framework: BUILTIN_PROJECT_STACK.framework,
      materialSet: { ...BUILTIN_PROJECT_STACK.materialSet },
      pages: [],
      layout: input.layout ?? { enabled: false, initialVariant: 'side' },
      routing: input.routing ?? { mode: 'browser', basePath: '/' },
    });
  }

  async readSource(projectPath: string): Promise<string> {
    try {
      return await readFile(join(projectPath, 'origamix.project.json'), 'utf8');
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        throw invalid('项目配置文件 origamix.project.json 缺失，请恢复后重新打开');
      throw error;
    }
  }

  async readManifest(projectPath: string): Promise<ProjectManifest> {
    return this.parseManifest(await this.readSource(projectPath));
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

  async requireEditable(projectPath: string): Promise<ProjectManifest> {
    const source = await this.readSource(projectPath);
    const manifest = this.parseManifest(source);
    try {
      validateResolvedProjectStack(resolveProjectStack(manifest));
    } catch (reason) {
      throw invalid(reason instanceof Error ? reason.message : '项目契约不兼容');
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
    return this.resolveStack(await this.requireEditable(projectPath));
  }

  async readPages(projectPath: string): Promise<ProjectPageManifest[]> {
    return (await this.readManifest(projectPath)).pages;
  }

  async addPage(
    projectPath: string,
    page: ProjectPageManifest,
    role?: PageRoleId,
    expectedSource?: string,
  ): Promise<void> {
    const source = await this.readSource(projectPath);
    if (expectedSource !== undefined && source !== expectedSource)
      throw conflict('项目配置已变化，请重新读取后确认');
    const manifest = this.parseManifest(source);
    await this.writeManifest(projectPath, {
      ...manifest,
      pages: [...manifest.pages, page],
      ...(role
        ? {
            pageRoles: { assignments: { ...manifest.pageRoles?.assignments, [role]: page.pageId } },
          }
        : {}),
    });
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
    const pageRoles = manifest.pageRoles
      ? {
          ...manifest.pageRoles,
          assignments: Object.fromEntries(
            Object.entries(manifest.pageRoles.assignments).filter(
              ([, assigned]) => assigned !== pageId,
            ),
          ),
        }
      : undefined;
    await this.writeManifest(projectPath, {
      ...manifest,
      pages,
      ...(pageRoles ? { pageRoles } : {}),
    });
  }
}
