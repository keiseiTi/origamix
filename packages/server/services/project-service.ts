import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { copyTemplate } from '../template';
import { join } from 'node:path';
import { nanoid } from 'nanoid';
import type { OpenProjectResult, PageRecord, ProjectRecord } from '@origamix/shared/protocol/api';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import { validatePage } from '@origamix/shared/protocol/validation';
import { getSchema, initializePageSchema, reconcilePageSchema } from './schema-service';
import type { ProjectRepository } from '../repositories/project-repository';
import { conflict, invalid, notFound } from '../errors';
import { ProjectFormatService } from './project-format-service';
import { ProjectLifecycleService } from './project-lifecycle-service';
import { ProjectScaffoldService } from './project-scaffold-service';
import { ProjectApplyService } from './project-apply-service';

const now = (): string => new Date().toISOString();
const projectQueues = new Map<string, Promise<void>>();

async function withProjectQueue<T>(projectId: string, action: () => Promise<T>): Promise<T> {
  const previous = projectQueues.get(projectId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  projectQueues.set(projectId, current);
  await previous;
  try {
    return await action();
  } finally {
    release();
    if (projectQueues.get(projectId) === current) projectQueues.delete(projectId);
  }
}
const schemaTemplate = (): OrigamixPageSchema => ({
  elements: { element_root: { type: 'container', props: {} } },
  layout: { root: 'element_root', structure: { element_root: [] } },
  flows: {},
  bindElements: [],
  context: { globalVariables: [] },
  extensions: { origamix: { schemaVersion: '1.0' } },
});

async function atomicWrite(path: string, contents: string): Promise<void> {
  const temporary = `${path}.${nanoid()}.tmp`;
  await writeFile(temporary, contents, { mode: 0o600 });
  await rename(temporary, path);
}

function pageComponentName(slug: string): string {
  return `Page${slug.replace(/(^|-)([a-z0-9])/g, (_, __, character: string) => character.toUpperCase())}`;
}

function pageComponentSource(slug: string): string {
  const componentName = pageComponentName(slug);
  return `import { OrigamixPage } from '@origamix/runtime/react';\nimport materials from '@origamix/materials/antd';\nimport schema from './schema.json';\n\nexport default function ${componentName}(): React.JSX.Element {\n  return <OrigamixPage schema={schema} materials={materials} />;\n}\n`;
}

export class ProjectService {
  private readonly lifecycle = new ProjectLifecycleService();
  private readonly format = new ProjectFormatService();
  private readonly scaffold: ProjectScaffoldService;

  constructor(
    private readonly projects: ProjectRepository,
    private readonly templatePath: string,
    private readonly projectApply = new ProjectApplyService(projects),
  ) {
    this.scaffold = new ProjectScaffoldService(templatePath);
  }

  registerGrant(id: string, path: string): void {
    this.lifecycle.registerGrant(id, path);
  }

  private consumeGrant(id: string): string {
    return this.lifecycle.consumeGrant(id);
  }

  private resolveGrant(id: string): string {
    return this.lifecycle.resolveGrant(id);
  }

  async createProject(input: {
    name: string;
    code: string;
    directoryGrantId: string;
  }): Promise<ProjectRecord> {
    const name = input.name.trim();
    if (!name || /[\\/:*?"<>|]/.test(name)) throw invalid('项目名称无效');
    const code = input.code.trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code)) {
      throw invalid('项目标识仅支持小写字母、数字和连字符');
    }
    const parentPath = this.consumeGrant(input.directoryGrantId);
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
      await copyTemplate(this.templatePath, temporaryPath);
      await mkdir(join(temporaryPath, '.origamix', 'revisions'), { recursive: true });
      await atomicWrite(
        join(temporaryPath, 'origamix.project.json'),
        `${JSON.stringify({ projectId: id, name, framework: 'react', uiLibrary: 'antd', pages: [] }, null, 2)}\n`,
      );
      await atomicWrite(
        join(temporaryPath, 'README.md'),
        `# ${name}\n\n项目标识：\`${code}\`\n\n## 使用\n\n\`\`\`sh\npnpm install\npnpm dev\npnpm build\npnpm preview\n\`\`\`\n\n生产部署请发布 \`dist/\`。项目使用浏览器历史路由，静态服务器需要把未知子路由回退到 \`index.html\`，以支持页面直接访问和刷新。\n`,
      );
      const packageJson = JSON.parse(
        await readFile(join(temporaryPath, 'package.json'), 'utf8'),
      ) as Record<string, unknown>;
      await atomicWrite(
        join(temporaryPath, 'package.json'),
        `${JSON.stringify({ ...packageJson, name: code }, null, 2)}\n`,
      );
      await atomicWrite(
        join(temporaryPath, 'index.html'),
        (await readFile(join(temporaryPath, 'index.html'), 'utf8'))
          .replace('<html lang="en">', '<html lang="zh-CN">')
          .replace('<title>template</title>', `<title>${name}</title>`),
      );
      await rename(temporaryPath, path);
    } catch (error) {
      await rm(temporaryPath, { recursive: true, force: true });
      throw error;
    }
    return this.reconcile(path);
  }

  async openProject(input: {
    directoryGrantId: string;
    initializeIfNeeded?: boolean;
  }): Promise<OpenProjectResult> {
    const path = this.resolveGrant(input.directoryGrantId);
    try {
      await access(join(path, 'origamix.project.json'));
    } catch {
      if (!input.initializeIfNeeded)
        return { status: 'initialization_required', displayPath: path };
      await this.scaffold.initializeExistingDirectory(path);
    }
    this.consumeGrant(input.directoryGrantId);
    return { status: 'opened', project: await this.reconcile(path) };
  }

  async createPage(
    projectId: string,
    input: { name: string; slug: string; route?: string },
  ): Promise<PageRecord> {
    return this.createPageWithSchema(projectId, input, schemaTemplate());
  }

  private async createPageWithSchema(
    projectId: string,
    input: { name: string; slug: string; route?: string },
    schema: OrigamixPageSchema,
  ): Promise<PageRecord> {
    return withProjectQueue(projectId, () =>
      this.createPageWithSchemaUnlocked(projectId, input, schema),
    );
  }

  private async createPageWithSchemaUnlocked(
    projectId: string,
    input: { name: string; slug: string; route?: string },
    schema: OrigamixPageSchema,
  ): Promise<PageRecord> {
    const project = this.projects.getProject(projectId);
    if (!project || project.status !== 'available') throw notFound('项目不存在或不可用');
    const name = input.name.trim();
    if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) throw invalid('页面信息无效');
    const route = input.route ?? `/${input.slug}`;
    if (!/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/.test(route)) throw invalid('页面路由无效');
    const manifest = await this.format.readManifest(project.path);
    const pages = await this.format.readPages(project.path);
    if (pages.some((item) => item.slug === input.slug || item.route === route))
      throw conflict('页面标识或路由已存在');
    const pagePath = join(project.path, 'src', 'pages', input.slug);
    try {
      await access(pagePath);
      throw conflict('页面文件已经存在');
    } catch (error) {
      if (error instanceof Error && error.message === '页面文件已经存在') throw error;
    }
    const id = `page_${nanoid()}`;
    await mkdir(pagePath);
    await this.projectApply.initializeTarget(
      { projectPath: project.path, pageId: id, slug: input.slug },
      schema,
    );
    await atomicWrite(join(pagePath, 'index.tsx'), pageComponentSource(input.slug));
    await initializePageSchema({ projectPath: project.path, pageId: id, slug: input.slug }, schema);
    const nextPage = { pageId: id, name, slug: input.slug, route };
    await atomicWrite(
      join(project.path, 'origamix.project.json'),
      `${JSON.stringify({ ...manifest, pages: [...pages, nextPage] }, null, 2)}\n`,
    );
    await this.reconcile(project.path);
    const page = this.projects.getPage(projectId, id);
    if (!page) throw new Error('页面索引失败');
    return page;
  }

  async renameProject(projectId: string, nameInput: string): Promise<ProjectRecord> {
    const project = this.projects.getProject(projectId);
    if (!project) throw notFound('项目不存在');
    const name = nameInput.trim();
    if (!name || /[\\/:*?"<>|]/.test(name)) throw invalid('项目名称无效');
    await this.format.renameProject(project.path, name);
    return this.reconcile(project.path);
  }

  async renamePage(projectId: string, pageId: string, nameInput: string): Promise<PageRecord> {
    const project = this.projects.getProject(projectId);
    const page = this.projects.getPage(projectId, pageId);
    if (!project || !page) throw notFound('页面不存在');
    const name = nameInput.trim();
    if (!name) throw invalid('页面名称无效');
    await this.format.renamePage(project.path, pageId, name);
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
    });
    const pages = this.projects.listPages(projectId);
    const baseSlug = `${page.slug}-copy`;
    let slug = baseSlug;
    let suffix = 2;
    while (true) {
      let directoryExists = false;
      try {
        await access(join(project.path, 'src', 'pages', slug));
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

  deletePage(projectId: string, pageId: string): void {
    if (this.projects.hasActiveRuns(projectId, pageId))
      throw conflict('页面 Agent 正在运行，请先停止后再删除');
    if (!this.projects.deletePageRecord(projectId, pageId)) throw notFound('页面不存在');
  }

  deleteProject(projectId: string): void {
    if (this.projects.hasActiveRuns(projectId))
      throw conflict('项目中有 Agent 正在运行，请先停止后再删除');
    if (!this.projects.deleteProjectRecord(projectId)) throw notFound('项目不存在');
  }

  reconcile = async (path: string): Promise<ProjectRecord> => {
    const manifest = await this.format.readManifest(path);
    const pagesInManifest = await this.format.readPages(path);
    const timestamp = now();
    const pages: PageRecord[] = [];
    for (const item of pagesInManifest) {
      if (this.projects.isPageRemoved(manifest.projectId, item.pageId)) continue;
      const relativePath = join('src', 'pages', item.slug);
      const pagePath = join(path, relativePath);
      const pageRef = { projectPath: path, pageId: item.pageId, slug: item.slug };
      try {
        await reconcilePageSchema(pageRef);
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
        route: item.route,
        relativePath,
        status: 'active',
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
    const project: ProjectRecord = {
      id: manifest.projectId,
      name: manifest.name,
      path,
      formatVersion: 'current',
      status: 'available',
      createdAt: timestamp,
      lastOpenedAt: timestamp,
    };
    this.projects.reconcile(project, pages);
    return project;
  };
}
