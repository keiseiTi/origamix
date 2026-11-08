import { Check } from '@sinclair/typebox/value';
import { PageRoleIdSchema, type PageRoleId } from '@origamix/shared';
import { PageRoleStore, manifestHash } from './page-role-store';
import type { UpdatePageRoles } from '@origamix/shared';
import { withExclusiveProjectActivity, withProjectActivity } from './project-activity';
import {
  normalizePageDirectory,
  ensurePageDirectory,
  resolvePageDirectory,
} from './page-directory';
import { readPageDeletion, writePageDeletion } from './page-deletion-store';
import { createInitialPageSchema } from './initial-page-schema';
import { assertProjectNotUpgrading } from './project-upgrade-store';
import { KeyedQueue } from '../infrastructure/keyed-queue';
import { access, mkdir, rename, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { nanoid } from 'nanoid';
import {
  type OpenProjectResult,
  type PageRecord,
  type ProjectRecord,
  type OrigamixPageSchema,
  resolveProjectStack,
  isProjectLayoutEnabled,
  LAYOUT_NAME,
  type LayoutConfigState,
} from '@origamix/shared';

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
export class ProjectService {
  private readonly grants = new DirectoryGrants();
  private readonly manifest = new ProjectManifestStore();
  private readonly scaffold: ProjectScaffoldService;
  private readonly source: ProjectSourceService;

  constructor(
    private readonly projects: ProjectRepository,
    private readonly templatePath: string,
    private readonly projectApply = new ProjectApplyService(projects),
    private readonly clearDiagnostics?: (projectId: string, pageId?: string) => void,
  ) {
    this.scaffold = new ProjectScaffoldService(templatePath);
    this.source = new ProjectSourceService(templatePath);
  }

  registerGrant(id: string, path: string): void {
    this.grants.registerGrant(id, path);
  }

  async createProject(input: {
    layoutEnabled?: boolean;
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
        layout: { enabled: input.layoutEnabled ?? false },
        name,
        code,
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
    name?: string;
    code?: string;
    directoryGrantId: string;
    pageDirectory?: string;
    initializeIfNeeded?: boolean;
  }): Promise<OpenProjectResult> {
    const path = this.grants.resolveGrant(input.directoryGrantId);
    const directoryName = basename(path);
    const name = (input.name ?? directoryName).trim();
    if (!name || /[\\/:*?"<>|]/.test(name)) throw invalid('项目名称无效');
    const inferredCode =
      directoryName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'imported-project';
    const code = (input.code ?? inferredCode).trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code))
      throw invalid('项目标识仅支持小写字母、数字和连字符');
    const pageDirectory = normalizePageDirectory(input.pageDirectory);
    try {
      await access(join(path, 'origamix.project.json'));
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      if (this.projects.listProjects().some((project) => project.path === path))
        throw invalid('项目配置文件缺失，请恢复 origamix.project.json 后重新打开');
      try {
        await access(join(path, '.origamix'));
        throw invalid('项目配置文件缺失，请恢复 origamix.project.json 后重新打开');
      } catch (retainedError) {
        if (!(
          retainedError instanceof Error &&
          'code' in retainedError &&
          retainedError.code === 'ENOENT'
        ))
          throw retainedError;
      }
      if (!input.initializeIfNeeded)
        return {
          status: 'initialization_required',
          displayPath: path,
        };
      await this.scaffold.initializeDirectoryAsNewProject(path, { name, code, pageDirectory });
    }
    this.grants.consumeGrant(input.directoryGrantId);
    return { status: 'opened', project: await this.reconcile(path) };
  }

  async getStack(projectId: string) {
    const project = this.projects.getProject(projectId);
    if (!project || project.status !== 0) throw notFound('项目不存在或不可用');
    const manifest = await this.manifest.readManifest(project.path);
    if (manifest.projectId !== projectId) throw invalid('项目清单身份已变化，请重新打开项目');
    return resolveProjectStack(await this.manifest.requireEditable(project.path));
  }

  getPageRoles = (projectId: string) =>
    withProjectQueue(projectId, async () => {
      const project = this.projects.getProject(projectId);
      if (!project || project.status !== 0) throw notFound('项目不存在或不可用');
      return withProjectActivity(project.path, () =>
        new PageRoleStore().read(project.path, projectId),
      );
    });

  updatePageRoles = (input: UpdatePageRoles) =>
    withProjectQueue(input.projectId, async () => {
      const project = this.projects.getProject(input.projectId);
      if (!project || project.status !== 0) throw notFound('项目不存在或不可用');
      return withExclusiveProjectActivity(project.path, async () => {
        const result = await new PageRoleStore().update(project.path, input);
        if (input.page) await this.reconcile(project.path);
        return result;
      });
    });

  getLayoutConfig = (projectId: string): Promise<LayoutConfigState> =>
    withProjectQueue(projectId, async () => {
      const project = this.projects.getProject(projectId);
      if (!project || project.status !== 0) throw notFound('项目不存在或不可用');
      return withProjectActivity(project.path, async () => {
        const manifest = await this.manifest.requireEditable(project.path);
        if (manifest.projectId !== projectId) throw invalid('项目清单归属无效');
        return { name: LAYOUT_NAME, enabled: isProjectLayoutEnabled(manifest) };
      });
    });

  setLayoutEnabled = (projectId: string, enabled: boolean): Promise<LayoutConfigState> =>
    withProjectQueue(projectId, async () => {
      if (typeof enabled !== 'boolean') throw invalid('布局开关无效');
      const project = this.projects.getProject(projectId);
      if (!project || project.status !== 0) throw notFound('项目不存在或不可用');
      // Drain in-flight layout writes before disabling; keep retained drafts/history intact.
      return withExclusiveProjectActivity(project.path, async () => {
        const manifest = await this.manifest.requireEditable(project.path);
        if (manifest.projectId !== projectId) throw invalid('项目清单归属无效');
        if (!enabled && this.projects.hasActiveRuns(projectId, null))
          throw conflict('布局 Agent 正在运行，请先取消或等待完成');
        if (manifest.layout?.enabled !== enabled)
          await this.manifest.writeManifest(project.path, { ...manifest, layout: { enabled } });
        return { name: LAYOUT_NAME, enabled };
      });
    });

  async createPage(
    projectId: string,
    input: { name: string; slug: string; role?: PageRoleId; expectedManifestHash?: string },
  ): Promise<PageRecord> {
    return this.createPageWithSchema(projectId, input, createInitialPageSchema());
  }

  private async createPageWithSchema(
    projectId: string,
    input: { name: string; slug: string; role?: PageRoleId; expectedManifestHash?: string },
    schema: OrigamixPageSchema,
  ): Promise<PageRecord> {
    return withProjectQueue(projectId, () =>
      this.createPageWithSchemaUnlocked(projectId, input, schema),
    );
  }

  private async createPageWithSchemaUnlocked(
    projectId: string,
    input: { name: string; slug: string; role?: PageRoleId; expectedManifestHash?: string },
    schema: OrigamixPageSchema,
  ): Promise<PageRecord> {
    const project = this.projects.getProject(projectId);
    if (!project || project.status !== 0) throw notFound('项目不存在或不可用');
    const name = input.name.trim();
    if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) throw invalid('页面信息无效');
    const manifestSource = await this.manifest.readSource(project.path);
    const manifest = this.manifest.parseManifest(manifestSource);
    if (manifest.projectId !== projectId) throw invalid('项目清单归属无效');
    await this.manifest.requireEditable(project.path);
    if (input.role !== undefined && !Check(PageRoleIdSchema, input.role))
      throw invalid('页面角色无效');
    if (input.expectedManifestHash && manifestHash(manifestSource) !== input.expectedManifestHash)
      throw conflict('项目配置已变化，请重新读取后确认');
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
      await this.source.createPageEntry(
        project.path,
        manifest.pageDirectory,
        input.slug,
        resolveProjectStack(manifest),
      );
      await initializePageSchema(pageRef, schema);
      const nextPage = { pageId: id, name, slug: input.slug };
      await this.manifest.addPage(project.path, nextPage, input.role, manifestSource);
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
    return withProjectQueue(projectId, async () => {
      const project = this.projects.getProject(projectId);
      if (!project) throw notFound('项目不存在');
      const name = nameInput.trim();
      if (!name || /[\\/:*?"<>|]/.test(name)) throw invalid('项目名称无效');
      await this.manifest.renameProject(project.path, name);
      return this.reconcile(project.path);
    });
  }

  async renamePage(projectId: string, pageId: string, nameInput: string): Promise<PageRecord> {
    return withProjectQueue(projectId, async () => {
      const project = this.projects.getProject(projectId);
      const page = this.projects.getPage(projectId, pageId);
      if (!project || !page) throw notFound('页面不存在');
      const name = nameInput.trim();
      if (!name) throw invalid('页面名称无效');
      await this.manifest.renamePage(project.path, pageId, name);
      await this.reconcile(project.path);
      return this.projects.getPage(projectId, pageId)!;
    });
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
      const project = this.projects.getProject(projectId);
      const page = this.projects.getPage(projectId, pageId);
      if (!project) throw notFound('页面不存在');
      return withExclusiveProjectActivity(project.path, async () => {
        await assertProjectNotUpgrading(project.path);
        const manifest = await this.manifest.readManifest(project.path);
        if (manifest.projectId !== projectId) throw invalid('项目清单归属不匹配');
        let deletion = await readPageDeletion(project.path, pageId);
        if (deletion && deletion.projectId !== projectId) throw invalid('页面删除记录归属不匹配');
        if (deletion?.state === 'completed') {
          this.clearDiagnostics?.(projectId, pageId);
          return;
        }
        if (page && this.projects.hasActiveRuns(projectId, pageId))
          throw conflict('页面 Agent 正在运行，请先停止后再删除');
        const declared = manifest.pages.find((item) => item.pageId === pageId);
        if (!deletion) {
          if (!page || !declared || declared.slug !== page.slug) throw notFound('页面不存在');
          deletion = {
            version: 1,
            projectId,
            pageId,
            pageDirectory: manifest.pageDirectory,
            slug: page.slug,
            state: 'pending',
          };
        }
        if (
          declared &&
          (declared.slug !== deletion.slug || manifest.pageDirectory !== deletion.pageDirectory)
        )
          throw conflict('待删除页面路径已变化，请恢复原页面清单后重试');
        const deletedSlug = deletion.slug;
        if (
          deletion.state === 'pending' &&
          manifest.pages.some((item) => item.pageId !== pageId && item.slug === deletedSlug) &&
          manifest.pageDirectory === deletion.pageDirectory
        )
          throw conflict('待删除目录已被其他页面使用');
        if (deletion.state === 'pending') {
          await resolvePageDirectory(project.path, deletion.pageDirectory, deletion.slug);
          await writePageDeletion(project.path, deletion);
          // Keep the durable intent across every destructive stage. Only an explicit retry resumes it.
          await this.source.removePageDirectory(
            project.path,
            deletion.pageDirectory,
            deletion.slug,
          );
          await discardInitializedPageSchema({
            projectPath: project.path,
            pageId,
            slug: deletion.slug,
            relativePath: join('src', deletion.pageDirectory, deletion.slug),
          });
          deletion = { ...deletion, state: 'files_removed' };
          await writePageDeletion(project.path, deletion);
        }
        if (declared) await this.manifest.removePage(project.path, pageId);
        this.projects.deletePageRecord(projectId, pageId);
        await writePageDeletion(project.path, { ...deletion, state: 'completed' });
        this.clearDiagnostics?.(projectId, pageId);
      });
    });
  }

  async deleteProject(projectId: string): Promise<void> {
    return withProjectQueue(projectId, async () => {
      const project = this.projects.getProject(projectId);
      if (!project) throw notFound('项目不存在');
      return withExclusiveProjectActivity(project.path, async () => {
        await assertProjectNotUpgrading(project.path);
        if (this.projects.hasActiveRuns(projectId))
          throw conflict('项目中有 Agent 正在运行，请先停止后再删除');
        if (!this.projects.deleteProjectRecord(projectId)) throw notFound('项目不存在');
        this.clearDiagnostics?.(projectId);
      });
    });
  }

  private withDestructiveProject<T>(projectId: string, action: () => Promise<T>): Promise<T> {
    return withProjectQueue(projectId, async () => {
      const project = this.projects.getProject(projectId);
      if (!project) throw notFound('项目不存在');
      return withExclusiveProjectActivity(project.path, action);
    });
  }

  reconcile = async (path: string): Promise<ProjectRecord> =>
    withProjectActivity(path, async () => {
      const manifest = await this.manifest.readManifest(path);
      const timestamp = now();
      const pages: PageRecord[] = [];
      for (const item of manifest.pages) {
        const relativePath = join('src', manifest.pageDirectory, item.slug);
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
    });
}
