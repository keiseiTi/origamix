import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { nanoid } from 'nanoid';
import { invalid, notFound } from '../errors';

export interface ProjectManifest {
  projectId: string;
  name: string;
  code?: string;
  projectFormatVersion?: string;
}

export interface ProjectRegistryItem {
  pageId: string;
  name: string;
  slug: string;
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
    return manifest;
  }

  async readRegistry(projectPath: string): Promise<ProjectRegistryItem[]> {
    let registry: ProjectRegistryItem[];
    try {
      registry = JSON.parse(
        await readFile(join(projectPath, 'src', 'pages', 'registry.json'), 'utf8'),
      ) as ProjectRegistryItem[];
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        throw invalid('项目缺少页面注册表');
      throw error;
    }
    if (!Array.isArray(registry)) throw invalid('页面注册表无效');
    return registry;
  }

  async renameProject(projectPath: string, name: string): Promise<void> {
    const manifest = await this.readManifest(projectPath);
    await atomicWrite(
      join(projectPath, 'origamix.project.json'),
      `${JSON.stringify({ ...manifest, name }, null, 2)}\n`,
    );
  }

  async renamePage(
    projectPath: string,
    relativePath: string,
    pageId: string,
    name: string,
  ): Promise<void> {
    const registry = await this.readRegistry(projectPath);
    const next = registry.map((item) => (item.pageId === pageId ? { ...item, name } : item));
    if (!next.some((item) => item.pageId === pageId)) throw notFound('页面注册信息不存在');
    await atomicWrite(
      join(projectPath, 'src', 'pages', 'registry.json'),
      `${JSON.stringify(next, null, 2)}\n`,
    );
    const metaPath = join(projectPath, relativePath, 'page.meta.json');
    const meta = JSON.parse(await readFile(metaPath, 'utf8')) as ProjectRegistryItem;
    await atomicWrite(metaPath, `${JSON.stringify({ ...meta, name }, null, 2)}\n`);
  }
}
