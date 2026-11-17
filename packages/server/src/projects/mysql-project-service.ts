import { nanoid } from 'nanoid';
import type { Pool, PoolConnection } from 'mysql2/promise';
import {
  emptyPageRoles,
  equalJson,
  isProjectManifest,
  projectShellIssue,
  resolveProjectStack,
  validateResolvedProjectStack,
  type InitialLayoutVariant,
  type ProjectRouting,
  type ProjectRoutingUpdate,
  type ProjectSettingsUpdate,
  type ProjectManifest,
  type ProjectRecord,
  type PageRecord,
  type PageRoleId,
  type UpdatePageRoles,
  type OrigamixPageSchema,
} from '@origamix/shared';
import { inWebTransaction } from '../database/mysql-web';
import { ApiError, conflict, invalid, notFound } from '../errors';
import { hashJson } from '../infrastructure/json-hash';
import { MysqlSchemaStore } from '../schema/mysql-schema-store';
import type { SchemaPageRef } from '../schema/schema-contracts';
import {
  discardInitializedPageSchema,
  getSchema,
  initializePageSchema,
} from '../schema/schema-service';
import { createInitialPageSchema } from './initial-page-schema';
import { normalizePageDirectory } from './page-directory';
import { createProjectManifest } from './project-manifest-store';

import { MysqlProjectRepository, type ProjectRow, type PageRow } from './mysql-project-repository';

interface WebProject {
  row: ProjectRow;
  manifest: ProjectManifest;
  pages: PageRow[];
}
export interface CreateDatabaseProject {
  name: string;
  code: string;
  pageDirectory: string;
  layoutEnabled?: boolean;
  layoutVariant?: InitialLayoutVariant;
  routing?: ProjectRouting;
}
type CreatePage = { name: string; slug: string; role?: PageRoleId; expectedManifestHash?: string };

const configuration = ({
  runtime,
  framework,
  materialSet,
  pageDirectory,
  name,
  shell,
  layout,
  routing,
  pageRoles,
}: ProjectManifest) =>
  JSON.stringify({
    runtime,
    framework,
    materialSet,
    pageDirectory,
    name,
    shell,
    layout,
    routing,
    pageRoles,
  });

const toProject = (row: ProjectRow, manifest: ProjectManifest): ProjectRecord => ({
  id: row.id,
  name: manifest.name,
  path: '',
  status: 0,
  createdAt: row.created_at,
  lastOpenedAt: row.created_at,
});

const toPage = (row: PageRow, manifest: ProjectManifest): PageRecord => ({
  id: row.id,
  projectId: row.project_id,
  slug: row.slug,
  name: row.name,
  relativePath: `src/${manifest.pageDirectory}/${row.slug}`,
  status: 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildProject = (row: ProjectRow, pages: PageRow[]): WebProject => {
  const manifest: unknown = {
    ...JSON.parse(row.configuration),
    projectId: row.id,
    code: row.code,
    pages: pages.map((page) => ({ pageId: page.id, name: page.name, slug: page.slug })),
  };
  if (!isProjectManifest(manifest)) throw invalid('Web 项目配置无效');
  return { row, manifest, pages };
};

const findPage = (project: WebProject, pageId: string) => {
  const page = project.pages.find(({ id }) => id === pageId);
  if (!page) throw notFound('页面不存在');
  return page;
};

const pageRef = (
  connection: PoolConnection,
  project: WebProject,
  page: PageRow,
): SchemaPageRef => ({
  projectPath: '',
  pageId: page.id,
  slug: page.slug,
  relativePath: toPage(page, project.manifest).relativePath,
  persistence: {
    manifest: project.manifest,
    store: new MysqlSchemaStore(connection, project.row.id),
  },
});

const writeConfiguration = async (
  repository: MysqlProjectRepository,
  manifest: ProjectManifest,
): Promise<void> => {
  if (!isProjectManifest(manifest)) throw invalid('项目配置或页面关联无效');
  await repository.writeConfiguration(manifest.projectId, configuration(manifest));
};

const getSettings = ({ manifest }: WebProject) => ({
  projectId: manifest.projectId,
  name: manifest.name,
  pages: manifest.pages,
  shell: manifest.shell,
  layout: manifest.layout,
  routing: manifest.routing,
  manifestHash: hashJson(manifest),
});

const getRoles = (manifest: ProjectManifest) => ({
  roles: manifest.pageRoles ?? emptyPageRoles(),
  manifestHash: hashJson(manifest),
  pages: manifest.pages.map(({ pageId, name }) => ({ pageId, name })),
});

export class MysqlProjectService {
  constructor(private readonly pool: Pool) {}

  // All schema and lifecycle mutations share the database's project-row lock.
  private withProject<T>(
    projectId: string,
    action: (
      repository: MysqlProjectRepository,
      project: WebProject,
      connection: PoolConnection,
    ) => T | Promise<T>,
    agentAdmission = false,
  ): Promise<T> {
    return inWebTransaction(this.pool, async (connection) => {
      const repository = new MysqlProjectRepository(connection);
      if (agentAdmission) await repository.lockAgentAdmission();
      const row = await repository.lockProject(projectId);
      if (!row) throw notFound('项目不存在');
      return action(
        repository,
        buildProject(row, await repository.listPages(projectId)),
        connection,
      );
    });
  }

  withAgentPage<T>(
    projectId: string,
    pageId: string,
    action: (sql: PoolConnection, page: SchemaPageRef) => Promise<T>,
  ): Promise<T> {
    return this.withProject(
      projectId,
      (_repository, project, connection) =>
        action(connection, pageRef(connection, project, findPage(project, pageId))),
      true,
    );
  }

  agentProjects = {
    getProject: async (projectId: string) =>
      await this.readOptionalProject(projectId, ({ row, manifest }) => ({
        ...toProject(row, manifest),
        path: projectId,
      })),
    getPage: async (projectId: string, pageId: string) =>
      await this.readOptionalProject(projectId, (project) => {
        const page = project.pages.find(({ id }) => id === pageId);
        return page ? toPage(page, project.manifest) : undefined;
      }),
  };

  private async readOptionalProject<T>(projectId: string, read: (project: WebProject) => T) {
    try {
      return await this.withProject(projectId, (_repository, project) => read(project));
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) return undefined;
      throw error;
    }
  }

  readManifest = (projectId: string) =>
    this.withProject(projectId, (_repository, project) => project.manifest);

  async listProjects() {
    return inWebTransaction(this.pool, async (connection) => {
      const repository = new MysqlProjectRepository(connection);
      const rows = await repository.listProjects();
      const pages = await repository.listPages();
      const byProject = new Map<string, PageRow[]>();
      for (const page of pages) {
        const records = byProject.get(page.project_id) ?? [];
        records.push(page);
        byProject.set(page.project_id, records);
      }
      return rows.map((row) => {
        const project = buildProject(row, byProject.get(row.id) ?? []);
        return {
          ...toProject(row, project.manifest),
          pages: project.pages.map((page) => toPage(page, project.manifest)),
        };
      });
    });
  }

  listPages = (projectId: string) =>
    this.withProject(projectId, (_repository, project) =>
      project.pages.map((page) => toPage(page, project.manifest)),
    );

  resolveSchemaPage = (projectId: string, pageId: string): SchemaPageRef => ({
    projectPath: '',
    pageId,
    slug: '',
    withPersistence: (action) =>
      this.withProject(projectId, (_repository, project, connection) => {
        const ref = pageRef(connection, project, findPage(project, pageId));
        return action(ref.persistence!);
      }),
  });

  async createDatabaseProject(input: CreateDatabaseProject): Promise<ProjectRecord> {
    const name = input.name.trim();
    if (!name || /[\\/:*?"<>|]/.test(name)) throw invalid('项目名称无效');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.code) || input.code.length > 128)
      throw invalid('项目标识无效或超过 128 字符');
    const id = `project_${nanoid()}`;
    const manifest = createProjectManifest({
      projectId: id,
      name,
      code: input.code,
      runtime: 'origamix',
      pageDirectory: normalizePageDirectory(input.pageDirectory),
      layout: {
        enabled: input.layoutEnabled ?? false,
        initialVariant: input.layoutVariant ?? 'mix',
      },
      routing: input.routing,
    });
    if (!isProjectManifest(manifest)) throw invalid('项目配置无效');
    const created_at = new Date().toISOString();
    const row = { id, code: input.code, configuration: configuration(manifest), created_at };
    try {
      await new MysqlProjectRepository(this.pool).insertProject(row);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ER_DUP_ENTRY')
        throw conflict('项目标识已存在');
      throw error;
    }
    return toProject(row, manifest);
  }

  private insertPage = async (
    repository: MysqlProjectRepository,
    connection: PoolConnection,
    project: WebProject,
    input: CreatePage,
    schema: OrigamixPageSchema,
  ) => {
    const name = input.name.trim();
    if (
      !name ||
      name.length > 80 ||
      input.slug.length > 128 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)
    )
      throw invalid('页面信息无效');
    if (input.expectedManifestHash && input.expectedManifestHash !== hashJson(project.manifest))
      throw conflict('项目配置已变化，请重新读取后确认');
    if (project.pages.some((page) => page.slug === input.slug)) throw conflict('页面标识已存在');

    const id = `page_${nanoid()}`;
    const now = new Date().toISOString();
    const page = {
      id,
      project_id: project.row.id,
      name,
      slug: input.slug,
      created_at: now,
      updated_at: now,
    };
    const manifest = {
      ...project.manifest,
      pages: [...project.manifest.pages, { pageId: id, name, slug: input.slug }],
    };
    if (input.role) {
      manifest.pageRoles = {
        assignments: { ...manifest.pageRoles?.assignments, [input.role]: id },
      };
      await writeConfiguration(repository, manifest);
    }
    await repository.insertPage(page);
    await initializePageSchema(pageRef(connection, { ...project, manifest }, page), schema);
    return toPage(page, manifest);
  };

  createPage = (projectId: string, input: CreatePage) =>
    this.withProject(projectId, (repository, project, connection) =>
      this.insertPage(repository, connection, project, input, createInitialPageSchema()),
    );

  duplicatePage = (projectId: string, pageId: string, name?: string) =>
    this.withProject(projectId, async (repository, project, connection) => {
      const page = findPage(project, pageId);
      const { schema } = await getSchema(pageRef(connection, project, page));
      const base = `${page.slug.slice(0, 108).replace(/-+$/, '')}-copy`;
      let slug = base;
      for (let index = 2; project.pages.some((item) => item.slug === slug); index++)
        slug = `${base}-${index}`;
      return this.insertPage(
        repository,
        connection,
        project,
        { name: name?.trim() || `${page.name.slice(0, 77)} 副本`, slug },
        schema,
      );
    });

  getStack = (projectId: string) =>
    this.withProject(projectId, (_repository, { manifest }) =>
      validateResolvedProjectStack(resolveProjectStack(manifest)),
    );

  getNavigation = (projectId: string) =>
    this.withProject(projectId, (_repository, { manifest }) => ({
      runtime: manifest.runtime,
      layoutEnabled: manifest.layout.enabled,
      pages: manifest.pages.map(({ pageId, name }) => ({ pageId, name })),
    }));

  getSettings = (projectId: string) =>
    this.withProject(projectId, (_repository, project) => getSettings(project));

  updateSettings = (input: ProjectSettingsUpdate) =>
    this.withProject(input.projectId, async (repository, project) => {
      const { manifest } = project;
      const name = input.name?.trim() ?? manifest.name;
      if (!name || /[\\/:*?"<>|]/.test(name)) throw invalid('项目名称无效');
      const issue = projectShellIssue(input.shell, manifest.pages);
      if (issue) throw invalid(issue);
      const next = {
        ...manifest,
        name,
        shell: input.shell,
        layout: input.layout,
        routing: input.routing,
      };
      if (!equalJson(next, manifest)) {
        if (hashJson(manifest) !== input.expectedManifestHash)
          throw conflict('项目配置已变化，请重新读取');
        if (!(await repository.assertNoActiveRuns(input.projectId)))
          throw conflict('请先停止项目 Agent 再保存项目设置');
        await writeConfiguration(repository, next);
      }
      return getSettings({ ...project, manifest: next });
    });

  getRouting = (projectId: string) =>
    this.withProject(projectId, (_repository, { manifest }) => ({
      routing: manifest.routing,
      manifestHash: hashJson(manifest),
    }));

  updateRouting = (input: ProjectRoutingUpdate) =>
    this.withProject(input.projectId, async (repository, { manifest }) => {
      const next = { ...manifest, routing: input.routing };
      if (!equalJson(manifest.routing, input.routing)) {
        if (hashJson(manifest) !== input.expectedManifestHash)
          throw conflict('项目配置已变化，请重新读取');
        await writeConfiguration(repository, next);
      }
      return { routing: next.routing, manifestHash: hashJson(next) };
    });

  getPageRoles = (projectId: string) =>
    this.withProject(projectId, (_repository, { manifest }) => getRoles(manifest));

  updatePageRoles = (input: UpdatePageRoles) =>
    this.withProject(input.projectId, async (repository, project) => {
      const { manifest } = project;
      const digest = hashJson(input);
      const prior = await repository.readRoleRequest(input.projectId, input.clientRequestId);
      if (prior) {
        if (prior !== digest) throw conflict('请求标识已用于其他角色操作');
        return getRoles(manifest);
      }
      if (input.expectedManifestHash !== hashJson(manifest))
        throw conflict('项目配置已变化，请重新读取');
      const next = { ...manifest, pageRoles: input.roles };
      if (input.page) {
        const original = findPage(project, input.page.pageId);
        const name = input.page.name.trim();
        if (!name) throw invalid('页面名称无效');
        next.pages = manifest.pages.map((page) =>
          page.pageId === original.id ? { ...page, name } : page,
        );
        await repository.updatePageName(original, name);
      }
      await writeConfiguration(repository, next);
      await repository.recordRoleRequest(input.projectId, input.clientRequestId, digest);
      return getRoles(next);
    });

  renameProject = (projectId: string, input: string) =>
    this.withProject(projectId, async (repository, { row, manifest }) => {
      const name = input.trim();
      if (!name || /[\\/:*?"<>|]/.test(name)) throw invalid('项目名称无效');
      const next = { ...manifest, name };
      await writeConfiguration(repository, next);
      return toProject(row, next);
    });

  renamePage = (projectId: string, pageId: string, input: string) =>
    this.withProject(projectId, async (repository, project) => {
      const name = input.trim();
      if (!name) throw invalid('页面名称无效');
      return toPage(
        await repository.updatePageName(findPage(project, pageId), name),
        project.manifest,
      );
    });

  deletePage = (projectId: string, pageId: string) =>
    this.withProject(projectId, async (repository, project, connection) => {
      const page = findPage(project, pageId);
      if (!(await repository.assertNoActiveRuns(projectId, pageId)))
        throw conflict('请先停止页面 Agent');
      const { manifest } = project;
      const next = {
        ...manifest,
        pages: manifest.pages.filter((item) => item.pageId !== pageId),
        ...(manifest.pageRoles
          ? {
              pageRoles: {
                assignments: Object.fromEntries(
                  Object.entries(manifest.pageRoles.assignments).filter(
                    ([, assigned]) => assigned !== pageId,
                  ),
                ),
              },
            }
          : {}),
      };
      if (projectShellIssue(next.shell, next.pages))
        throw conflict('请先移除布局与路由中的页面引用');
      await writeConfiguration(repository, next);
      await discardInitializedPageSchema(pageRef(connection, project, page));
      await repository.deleteAgentRecords(projectId, pageId);
      await repository.deletePage(projectId, pageId);
    });

  deleteProject = (projectId: string) =>
    this.withProject(projectId, async (repository) => {
      if (!(await repository.assertNoActiveRuns(projectId))) throw conflict('请先停止项目 Agent');
      await repository.deleteAgentRecords(projectId);
      await repository.deleteProject(projectId);
    });
}
