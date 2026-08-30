import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { nanoid } from 'nanoid';
import type { PageRecord, ProjectRecord } from '../../src/shared/protocol/api';
import type { OrigamixPageSchema } from '../../src/shared/protocol/schema';
import { validatePage } from '../../src/shared/protocol/validation';
import { initializePageSchema } from '../../src/main/services/schema-service';
import type { ProjectRepository } from '../repositories/project-repository';
import type { WorkspaceRepository } from '../repositories/workspace-repository';

interface ProjectManifest {
  projectId: string;
  name: string;
  projectFormatVersion?: string;
}
interface RegistryItem {
  pageId: string;
  name: string;
  slug: string;
}

const now = (): string => new Date().toISOString();
const schemaTemplate = (): OrigamixPageSchema => ({
  elements: { element_root: { type: 'container', props: {} } },
  layout: { root: 'element_root', structure: { element_root: [] } },
  flows: {},
  bindElements: [],
  context: { globalVariables: [] },
  extensions: { origamix: { schemaVersion: '1.0' } }
});

async function atomicWrite(path: string, contents: string): Promise<void> {
  const temporary = `${path}.${nanoid()}.tmp`;
  await writeFile(temporary, contents, { mode: 0o600 });
  await rename(temporary, path);
}

export class ProjectService {
  private readonly grants = new Map<string, string>();

  constructor(
    private readonly projects: ProjectRepository,
    private readonly workspace: WorkspaceRepository
  ) {}

  registerGrant(id: string, path: string): void {
    this.grants.set(id, path);
  }

  private consumeGrant(id: string): string {
    const path = this.grants.get(id);
    if (!path) throw new Error('目录授权已失效，请重新选择目录');
    this.grants.delete(id);
    return path;
  }

  async createProject(input: { name: string; directoryGrantId: string }): Promise<ProjectRecord> {
    const name = input.name.trim();
    if (!name || /[\\/:*?"<>|]/.test(name)) throw new Error('项目名称无效');
    const parentPath = this.consumeGrant(input.directoryGrantId);
    const path = join(parentPath, name);
    try {
      await access(path);
      throw new Error('目标目录已经存在');
    } catch (error) {
      if (error instanceof Error && error.message === '目标目录已经存在') throw error;
    }
    const id = `project_${nanoid()}`;
    await mkdir(join(path, 'src', 'pages'), { recursive: true });
    await mkdir(join(path, '.origamix', 'revisions'), { recursive: true });
    await atomicWrite(
      join(path, 'origamix.project.json'),
      `${JSON.stringify({ projectId: id, name, projectFormatVersion: '1', schemaVersion: '1', templateVersion: '1', materialSets: [{ id: 'official', version: '1' }] }, null, 2)}\n`
    );
    await atomicWrite(join(path, 'src', 'pages', 'registry.json'), '[]\n');
    await atomicWrite(
      join(path, 'package.json'),
      `${JSON.stringify({ name: name.toLowerCase().replace(/\s+/g, '-'), private: true, version: '0.0.0', scripts: { dev: 'vite', build: 'vite build' } }, null, 2)}\n`
    );
    return this.reconcile(path);
  }

  async openProject(input: { directoryGrantId: string }): Promise<ProjectRecord> {
    return this.reconcile(this.consumeGrant(input.directoryGrantId));
  }

  async createPage(projectId: string, input: { name: string; slug: string }): Promise<PageRecord> {
    const project = this.projects.getProject(projectId);
    if (!project || project.status !== 'available') throw new Error('项目不存在或不可用');
    const name = input.name.trim();
    if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) throw new Error('页面信息无效');
    const pagePath = join(project.path, 'src', 'pages', input.slug);
    try {
      await access(pagePath);
      throw new Error('页面文件已经存在');
    } catch (error) {
      if (error instanceof Error && error.message === '页面文件已经存在') throw error;
    }
    const id = `page_${nanoid()}`;
    await mkdir(pagePath);
    await atomicWrite(
      join(pagePath, 'page.meta.json'),
      `${JSON.stringify({ pageId: id, name, slug: input.slug }, null, 2)}\n`
    );
    const schema = schemaTemplate();
    await atomicWrite(join(pagePath, 'schema.json'), `${JSON.stringify(schema, null, 2)}\n`);
    await initializePageSchema({ projectPath: project.path, pageId: id, slug: input.slug }, schema);
    const registryPath = join(project.path, 'src', 'pages', 'registry.json');
    const registry = JSON.parse(await readFile(registryPath, 'utf8')) as RegistryItem[];
    await atomicWrite(
      registryPath,
      `${JSON.stringify([...registry, { pageId: id, name, slug: input.slug }], null, 2)}\n`
    );
    await this.reconcile(project.path);
    const page = this.projects.getPage(projectId, id);
    if (!page) throw new Error('页面索引失败');
    this.workspace.save({ activeProjectId: projectId, activePageId: id });
    return page;
  }

  reconcile = async (path: string): Promise<ProjectRecord> => {
    const manifest = JSON.parse(
      await readFile(join(path, 'origamix.project.json'), 'utf8')
    ) as ProjectManifest;
    if (!manifest.projectId || !manifest.name) throw new Error('项目清单无效');
    const registry = JSON.parse(
      await readFile(join(path, 'src', 'pages', 'registry.json'), 'utf8')
    ) as RegistryItem[];
    if (!Array.isArray(registry)) throw new Error('页面注册表无效');
    const timestamp = now();
    const pages: PageRecord[] = [];
    for (const item of registry) {
      const relativePath = join('src', 'pages', item.slug);
      const pagePath = join(path, relativePath);
      const meta = JSON.parse(
        await readFile(join(pagePath, 'page.meta.json'), 'utf8')
      ) as RegistryItem;
      const schema = JSON.parse(
        await readFile(join(pagePath, 'schema.json'), 'utf8')
      ) as OrigamixPageSchema;
      if (meta.pageId !== item.pageId || meta.slug !== item.slug || !validatePage(schema).valid)
        throw new Error(`页面“${item.name}”无效`);
      pages.push({
        id: item.pageId,
        projectId: manifest.projectId,
        name: item.name,
        slug: item.slug,
        relativePath,
        status: 'active',
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }
    const project: ProjectRecord = {
      id: manifest.projectId,
      name: manifest.name,
      path,
      formatVersion: manifest.projectFormatVersion ?? '1',
      status: 'available',
      createdAt: timestamp,
      lastOpenedAt: timestamp
    };
    this.projects.reconcile(project, pages);
    this.workspace.save({ activeProjectId: project.id, activePageId: pages[0]?.id ?? null });
    return project;
  };
}
