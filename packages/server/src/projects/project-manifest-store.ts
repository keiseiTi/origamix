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
  validateResolvedProjectStack,
  isSemanticVersion,
} from '@origamix/shared';

import { invalid, notFound } from '../errors';

export class ProjectManifestStore {
  async writeManifest(projectPath: string, manifest: ProjectManifest): Promise<void> {
    await assertProjectNotUpgrading(projectPath);
    try {
      const source = await readFile(join(projectPath, 'origamix.project.json'), 'utf8');
      if (this.legacyVersion(source)) throw invalid('项目清单需要显式转换，请打开兼容性检查');
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
    input: Pick<ProjectManifest, 'projectId' | 'name' | 'pageDirectory'> & { code: string },
  ): Promise<void> {
    await this.writeManifest(projectPath, {
      ...input,
      framework: BUILTIN_PROJECT_STACK.framework,
      materialSet: { ...BUILTIN_PROJECT_STACK.materialSet },
      pages: [],
      layout: { enabled: false },
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
    const legacy = this.legacyVersion(source);
    if (legacy) {
      if (legacy !== '1.0.0')
        throw invalid(`旧项目配置 ${legacy} 没有已知的物料版本映射，请使用兼容应用`);
      const fields = { ...(manifest as Record<string, unknown>) };
      delete fields.version;
      delete fields.uiLibrary;
      manifest = { ...fields, materialSet: { id: 'official-antd', version: '1.0.0' } };
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

  legacyVersion(source: string): string | null {
    const value = JSON.parse(source) as Record<string, unknown> | null;
    if (
      value &&
      value.materialSet === 'official-antd' &&
      value.framework === 'react' &&
      value.uiLibrary === 'antd' &&
      isSemanticVersion(value.version)
    )
      return value.version;
    return null;
  }

  async requireEditable(projectPath: string): Promise<ProjectManifest> {
    const source = await this.readSource(projectPath);
    const manifest = this.parseManifest(source);
    if (this.legacyVersion(source))
      throw invalid('项目清单需要显式转换，请打开兼容性检查；原数据已保留');
    try {
      validateResolvedProjectStack(resolveProjectStack(manifest));
    } catch (reason) {
      throw invalid(reason instanceof Error ? reason.message : '项目契约不兼容');
    }
    await assertProjectNotUpgrading(projectPath);
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
