import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { copyTemplate } from '../template';
import { basename, join } from 'node:path';
import { nanoid } from 'nanoid';
import type { PageRecord, ProjectRecord } from '@origamix/shared/protocol/api';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import { validatePage } from '@origamix/shared/protocol/validation';
import { initializePageSchema } from './schema-service';
import type { ProjectRepository } from '../repositories/project-repository';
import { conflict, invalid, notFound } from '../errors';

interface ProjectManifest {
  projectId: string;
  name: string;
  code?: string;
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

function pageComponentSource(name: string, slug: string): string {
  const componentName = pageComponentName(slug);
  return `export default function ${componentName}(): React.JSX.Element {\n  return <main><h1>${name}</h1></main>;\n}\n`;
}

function routerSource(registry: RegistryItem[]): string {
  const imports = registry
    .map((page) => `import ${pageComponentName(page.slug)} from './pages/${page.slug}';`)
    .join('\n');
  const routes = registry
    .map(
      (page) =>
        `  {\n    path: '${page.slug === 'home' ? '/' : `/${page.slug}`}',\n    Component: ${pageComponentName(page.slug)}\n  }`,
    )
    .join(',\n');
  return `import { createBrowserRouter } from 'react-router';\n${imports}\n\nexport default createBrowserRouter([\n${routes}\n]);\n`;
}

export class ProjectService {
  private readonly grants = new Map<string, string>();

  constructor(
    private readonly projects: ProjectRepository,
    private readonly templatePath: string,
  ) {}

  registerGrant(id: string, path: string): void {
    this.grants.set(id, path);
  }

  private consumeGrant(id: string): string {
    const path = this.grants.get(id);
    if (!path) throw invalid('目录授权已失效，请重新选择目录');
    this.grants.delete(id);
    return path;
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
    const homePage: RegistryItem = { pageId: `page_${nanoid()}`, name: '首页', slug: 'home' };
    try {
      await copyTemplate(this.templatePath, temporaryPath);
      await mkdir(join(temporaryPath, '.origamix', 'revisions'), { recursive: true });
      await atomicWrite(
        join(temporaryPath, 'origamix.project.json'),
        `${JSON.stringify({ projectId: id, name, code, projectFormatVersion: '1', schemaVersion: '1', templateVersion: '1', materialSets: [{ id: 'official', version: '1' }] }, null, 2)}\n`,
      );
      await atomicWrite(join(temporaryPath, 'README.md'), `# ${name}\n\n项目标识：\`${code}\`\n`);
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
      await atomicWrite(
        join(temporaryPath, 'src', 'pages', 'registry.json'),
        `${JSON.stringify([homePage], null, 2)}\n`,
      );
      await atomicWrite(
        join(temporaryPath, 'src', 'pages', 'home', 'page.meta.json'),
        `${JSON.stringify({ pageId: homePage.pageId, name: homePage.name, slug: homePage.slug }, null, 2)}\n`,
      );
      const schema = schemaTemplate();
      await atomicWrite(
        join(temporaryPath, 'src', 'pages', 'home', 'schema.json'),
        `${JSON.stringify(schema, null, 2)}\n`,
      );
      await atomicWrite(
        join(temporaryPath, 'src', 'pages', 'home', 'index.tsx'),
        pageComponentSource(homePage.name, homePage.slug),
      );
      await atomicWrite(join(temporaryPath, 'src', 'router.ts'), routerSource([homePage]));
      await initializePageSchema(
        { projectPath: temporaryPath, pageId: homePage.pageId, slug: homePage.slug },
        schema,
      );
      await rename(temporaryPath, path);
    } catch (error) {
      await rm(temporaryPath, { recursive: true, force: true });
      throw error;
    }
    return this.reconcile(path);
  }

  async openProject(input: { directoryGrantId: string }): Promise<ProjectRecord> {
    return this.reconcile(this.consumeGrant(input.directoryGrantId));
  }

  async createPage(projectId: string, input: { name: string; slug: string }): Promise<PageRecord> {
    const project = this.projects.getProject(projectId);
    if (!project || project.status !== 'available') throw notFound('项目不存在或不可用');
    const name = input.name.trim();
    if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) throw invalid('页面信息无效');
    const pagePath = join(project.path, 'src', 'pages', input.slug);
    try {
      await access(pagePath);
      throw conflict('页面文件已经存在');
    } catch (error) {
      if (error instanceof Error && error.message === '页面文件已经存在') throw error;
    }
    const id = `page_${nanoid()}`;
    await mkdir(pagePath);
    await atomicWrite(
      join(pagePath, 'page.meta.json'),
      `${JSON.stringify({ pageId: id, name, slug: input.slug }, null, 2)}\n`,
    );
    const schema = schemaTemplate();
    await atomicWrite(join(pagePath, 'schema.json'), `${JSON.stringify(schema, null, 2)}\n`);
    await atomicWrite(join(pagePath, 'index.tsx'), pageComponentSource(name, input.slug));
    await initializePageSchema({ projectPath: project.path, pageId: id, slug: input.slug }, schema);
    const registryPath = join(project.path, 'src', 'pages', 'registry.json');
    const registry = JSON.parse(await readFile(registryPath, 'utf8')) as RegistryItem[];
    await atomicWrite(
      registryPath,
      `${JSON.stringify([...registry, { pageId: id, name, slug: input.slug }], null, 2)}\n`,
    );
    await atomicWrite(
      join(project.path, 'src', 'router.ts'),
      routerSource([...registry, { pageId: id, name, slug: input.slug }]),
    );
    await this.reconcile(project.path);
    const page = this.projects.getPage(projectId, id);
    if (!page) throw new Error('页面索引失败');
    return page;
  }

  reconcile = async (path: string): Promise<ProjectRecord> => {
    const manifestPath = join(path, 'origamix.project.json');
    let manifest: ProjectManifest;
    try {
      manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ProjectManifest;
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
      const directoryName = basename(path);
      manifest = {
        projectId: `project_${nanoid()}`,
        name: directoryName,
        code: directoryName,
        projectFormatVersion: '1',
      };
      await atomicWrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    }
    if (!manifest.projectId || !manifest.name) throw invalid('项目清单无效');
    const registryPath = join(path, 'src', 'pages', 'registry.json');
    let registry: RegistryItem[];
    try {
      registry = JSON.parse(await readFile(registryPath, 'utf8')) as RegistryItem[];
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
      await mkdir(join(path, 'src', 'pages'), { recursive: true });
      registry = [];
      await atomicWrite(registryPath, '[]\n');
    }
    if (!Array.isArray(registry)) throw invalid('页面注册表无效');
    const timestamp = now();
    const pages: PageRecord[] = [];
    for (const item of registry) {
      const relativePath = join('src', 'pages', item.slug);
      const pagePath = join(path, relativePath);
      const meta = JSON.parse(
        await readFile(join(pagePath, 'page.meta.json'), 'utf8'),
      ) as RegistryItem;
      const schema = JSON.parse(
        await readFile(join(pagePath, 'schema.json'), 'utf8'),
      ) as OrigamixPageSchema;
      if (meta.pageId !== item.pageId || meta.slug !== item.slug || !validatePage(schema).valid)
        throw invalid(`页面“${item.name}”无效`);
      pages.push({
        id: item.pageId,
        projectId: manifest.projectId,
        name: item.name,
        slug: item.slug,
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
      formatVersion: manifest.projectFormatVersion ?? '1',
      status: 'available',
      createdAt: timestamp,
      lastOpenedAt: timestamp,
    };
    this.projects.reconcile(project, pages);
    return project;
  };
}
