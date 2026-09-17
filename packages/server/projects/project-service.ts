import { KeyedQueue } from '../infrastructure/keyed-queue';
import { access, lstat, mkdir, readFile, realpath, rename, rm } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
import { nanoid } from 'nanoid';
import type { OpenProjectResult, PageRecord, ProjectRecord } from '@origamix/shared/protocol/api';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import { validatePage } from '@origamix/shared/protocol/validation';
import {
  discardInitializedPageSchema,
  getSchema,
  initializePageSchema,
} from '../schema/schema-service';
import type { ProjectRepository } from './project-repository';
import { conflict, invalid, notFound } from '../errors';
import { ProjectManifestStore } from './project-manifest-store';
import { DirectoryGrants } from './directory-grants';
import { ProjectScaffoldService } from './project-scaffold';
import { ProjectSourceService } from './project-source';
import { ProjectApplyService } from '../schema/project-apply-service';

const now = (): string => new Date().toISOString();
const projectQueue = new KeyedQueue();
const withProjectQueue = <T>(projectId: string, action: () => Promise<T>): Promise<T> =>
  projectQueue.run(projectId, action);
const normalizePageDirectory = (value = 'pages'): string => {
  const pageDirectory = value.trim();
  if (!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(pageDirectory))
    throw invalid('页面目录必须是 src 下的相对路径');
  return pageDirectory;
};
const ensurePageDirectory = async (projectPath: string, pageDirectory: string): Promise<string> => {
  const project = await realpath(projectPath);
  let directory = join(project, 'src');
  await mkdir(directory, { recursive: true });
  for (const segment of pageDirectory.split('/')) {
    const candidate = join(directory, segment);
    try {
      if ((await lstat(candidate)).isSymbolicLink()) throw invalid('页面目录不能是符号链接');
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      await mkdir(candidate);
    }
    const resolved = await realpath(candidate);
    const fromProject = relative(project, resolved);
    if (
      fromProject === '..' ||
      fromProject.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
      isAbsolute(fromProject)
    )
      throw invalid('页面目录不属于当前项目');
    directory = resolved;
  }
  return directory;
};
const schemaTemplate = (): OrigamixPageSchema => ({
  elements: { element_root: { type: 'container', props: {} } },
  layout: { root: 'element_root', structure: { element_root: [] } },
  flows: {},
  bindElements: [],
  context: { globalVariables: [] },
  extensions: { origamix: { schemaVersion: '1.0' } },
});

export class ProjectService {
  private readonly grants = new DirectoryGrants();
  private readonly manifest = new ProjectManifestStore();
  private readonly scaffold: ProjectScaffoldService;
  private readonly source: ProjectSourceService;

  constructor(
    private readonly projects: ProjectRepository,
    templatePath: string,
    private readonly projectApply = new ProjectApplyService(projects),
  ) {
    this.scaffold = new ProjectScaffoldService(templatePath);
    this.source = new ProjectSourceService(templatePath);
  }

  registerGrant(id: string, path: string): void {
    this.grants.registerGrant(id, path);
  }

  async createProject(input: {
    name: string;
    code: string;
    pageDirectory?: string;
    directoryGrantId: string;
  }): Promise<ProjectRecord> {
    const name = input.name.trim();
    if (!name || /[\\/:*?"<>|]/.test(name)) throw invalid('项目名称无效');
    const code = input.code.trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code)) {
      throw invalid('项目标识仅支持小写字母、数字和连字符');
    }
    const parentPath = this.grants.consumeGrant(input.directoryGrantId);
    const pageDirectory = normalizePageDirectory(input.pageDirectory);
    const path = join(parentPath, code);
    try {
      await access(path);
      throw conflict('目标目录已经存在');
    } catch (error) {
      if (error instanceof Error && error.message === '目标目录已经存在') throw error;
    }
    const temporaryPath = join(parentPath, `.${code}.${nanoid()}.tmp`);
    const id = `project_${nanoid()}`;
    try {
      await this.source.prepareNewProject(temporaryPath, { name, code });
      await this.manifest.initializeManifest(temporaryPath, {
        projectId: id,
        name,
        pageDirectory,
      });
      await rename(temporaryPath, path);
    } catch (error) {
      await rm(temporaryPath, { recursive: true, force: true });
      throw error;
    }
    return this.reconcile(path);
  }

  async openProject(input: {
    directoryGrantId: string;
    pageDirectory?: string;
    initializeIfNeeded?: boolean;
  }): Promise<OpenProjectResult> {
    const path = this.grants.resolveGrant(input.directoryGrantId);
    const pageDirectory = normalizePageDirectory(input.pageDirectory);
    try {
      await access(join(path, 'origamix.project.json'));
    } catch {
      if (!input.initializeIfNeeded)
        return {
          status: 'initialization_required',
          displayPath: path,
          inspection: await this.scaffold.inspectExistingDirectory(path, pageDirectory),
        };
      await this.scaffold.initializeExistingDirectory(path, pageDirectory);
    }
    this.grants.consumeGrant(input.directoryGrantId);
    return { status: 'opened', project: await this.reconcile(path) };
  }

  async createPage(projectId: string, input: { name: string; slug: string }): Promise<PageRecord> {
    return this.createPageWithSchema(projectId, input, schemaTemplate());
  }

  private async createPageWithSchema(
    projectId: string,
    input: { name: string; slug: string },
    schema: OrigamixPageSchema,
  ): Promise<PageRecord> {
    return withProjectQueue(projectId, () =>
      this.createPageWithSchemaUnlocked(projectId, input, schema),
    );
  }

  private async createPageWithSchemaUnlocked(
    projectId: string,
    input: { name: string; slug: string },
    schema: OrigamixPageSchema,
  ): Promise<PageRecord> {
    const project = this.projects.getProject(projectId);
    if (!project || project.status !== 0) throw notFound('项目不存在或不可用');
    const name = input.name.trim();
    if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) throw invalid('页面信息无效');
    const manifest = await this.manifest.readManifest(project.path);
    const pages = manifest.pages;
    if (pages.some((item) => item.slug === input.slug)) throw conflict('页面标识已存在');
    const relativePath = join('src', manifest.pageDirectory, input.slug);
    const pagesPath = await ensurePageDirectory(project.path, manifest.pageDirectory);
    const pagePath = join(pagesPath, input.slug);
    try {
      await access(pagePath);
      throw conflict('页面文件已经存在');
    } catch (error) {
      if (error instanceof Error && error.message === '页面文件已经存在') throw error;
    }
    const id = `page_${nanoid()}`;
    const pageRef = { projectPath: project.path, pageId: id, slug: input.slug, relativePath };
    let manifestCommitted = false;
    let pageDirectoryCreated = false;
    try {
      await mkdir(pagePath);
      pageDirectoryCreated = true;
      await this.projectApply.initializeTarget(pageRef, schema);
      await this.source.createPageEntry(project.path, manifest.pageDirectory, input.slug);
      await initializePageSchema(pageRef, schema);
      const nextPage = { pageId: id, name, slug: input.slug };
      await this.manifest.addPage(project.path, nextPage);
      manifestCommitted = true;
      await this.reconcile(project.path);
    } catch (error) {
      if (!manifestCommitted) {
        await Promise.allSettled([
          ...(pageDirectoryCreated
            ? [this.source.removePageDirectory(project.path, manifest.pageDirectory, input.slug)]
            : []),
          discardInitializedPageSchema(pageRef),
        ]);
        throw error;
      }
      throw conflict('页面已创建，但本地索引更新失败，请重新打开项目以重建页面索引');
    }
    const page = this.projects.getPage(projectId, id);
    if (!page) throw new Error('页面索引失败');
    return page;
  }

  async renameProject(projectId: string, nameInput: string): Promise<ProjectRecord> {
    const project = this.projects.getProject(projectId);
    if (!project) throw notFound('项目不存在');
    const name = nameInput.trim();
    if (!name || /[\\/:*?"<>|]/.test(name)) throw invalid('项目名称无效');
    await this.manifest.renameProject(project.path, name);
    return this.reconcile(project.path);
  }

  async renamePage(projectId: string, pageId: string, nameInput: string): Promise<PageRecord> {
    const project = this.projects.getProject(projectId);
    const page = this.projects.getPage(projectId, pageId);
    if (!project || !page) throw notFound('页面不存在');
    const name = nameInput.trim();
    if (!name) throw invalid('页面名称无效');
    await this.manifest.renamePage(project.path, pageId, name);
    await this.reconcile(project.path);
    return this.projects.getPage(projectId, pageId)!;
  }

  async duplicatePage(
    projectId: string,
    pageId: string,
    requestedName?: string,
  ): Promise<PageRecord> {
    const project = this.projects.getProject(projectId);
    const page = this.projects.getPage(projectId, pageId);
    if (!project || !page) throw notFound('页面不存在');
    const current = await getSchema({
      projectPath: project.path,
      pageId: page.id,
      slug: page.slug,
      relativePath: page.relativePath,
    });
    const pages = this.projects.listPages(projectId);
    const baseSlug = `${page.slug}-copy`;
    let slug = baseSlug;
    let suffix = 2;
    while (true) {
      let directoryExists = false;
      try {
        await access(join(project.path, page.relativePath, '..', slug));
        directoryExists = true;
      } catch {
        // A missing directory is available for the copy.
      }
      if (!directoryExists && !pages.some((item) => item.slug === slug)) break;
      slug = `${baseSlug}-${suffix++}`;
    }
    return this.createPageWithSchema(
      projectId,
      { name: requestedName?.trim() || `${page.name} 副本`, slug },
      current.schema,
    );
  }

  async deletePage(projectId: string, pageId: string): Promise<void> {
    await withProjectQueue(projectId, async () => {
      if (this.projects.hasActiveRuns(projectId, pageId))
        throw conflict('页面 Agent 正在运行，请先停止后再删除');
      const project = this.projects.getProject(projectId);
      const page = this.projects.getPage(projectId, pageId);
      if (!project || !page) throw notFound('页面不存在');
      const manifest = await this.manifest.readManifest(project.path);
      await this.manifest.removePage(project.path, pageId);
      await Promise.all([
        this.source.removePageDirectory(project.path, manifest.pageDirectory, page.slug),
        discardInitializedPageSchema({
          projectPath: project.path,
          pageId,
          slug: page.slug,
          relativePath: page.relativePath,
        }),
      ]);
      if (!this.projects.deletePageRecord(projectId, pageId)) throw notFound('页面不存在');
    });
  }

  deleteProject(projectId: string): void {
    if (this.projects.hasActiveRuns(projectId))
      throw conflict('项目中有 Agent 正在运行，请先停止后再删除');
    if (!this.projects.deleteProjectRecord(projectId)) throw notFound('项目不存在');
  }

  reconcile = async (path: string): Promise<ProjectRecord> => {
    const manifest = await this.manifest.readManifest(path);
    const timestamp = now();
    const pages: PageRecord[] = [];
    for (const item of manifest.pages) {
      const relativePath = join('src', manifest.pageDirectory, item.slug);
      const pagePath = join(path, relativePath);
      const pageRef = { projectPath: path, pageId: item.pageId, slug: item.slug, relativePath };
      try {
        await getSchema(pageRef);
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
        const target = JSON.parse(
          await readFile(join(pagePath, 'schema.json'), 'utf8'),
        ) as OrigamixPageSchema;
        await initializePageSchema(pageRef, target);
      }
      const schema = JSON.parse(
        await readFile(join(pagePath, 'schema.json'), 'utf8'),
      ) as OrigamixPageSchema;
      if (!validatePage(schema).valid) throw invalid(`页面“${item.name}”无效`);
      pages.push({
        id: item.pageId,
        projectId: manifest.projectId,
        name: item.name,
        slug: item.slug,
        relativePath,
        status: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
    const project: ProjectRecord = {
      id: manifest.projectId,
      name: manifest.name,
      path,
      status: 0,
      createdAt: timestamp,
      lastOpenedAt: timestamp,
    };
    this.projects.reconcile(project, pages);
    return project;
  };
}
