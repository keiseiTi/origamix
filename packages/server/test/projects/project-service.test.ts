import { ProjectManifestStore } from '../../src/projects/project-manifest-store';
import { access, mkdtemp, readFile, rm, writeFile, rename, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApplicationDatabase } from '../../src/database/database';
import { ProjectRepository } from '../../src/projects/project-repository';
import { ProjectService } from '../../src/projects/project-service';
import { ProjectApplyService } from '../../src/schema/project-apply-service';
import { ProjectSourceService } from '../../src/projects/project-source';
import { getWorkingSchemaState, updateWorkingSchema } from '../../src/schema/schema-service';
import { deferred } from '../helpers/deferred';

const directories: string[] = [];
const templatePath = fileURLToPath(new URL('../../../template', import.meta.url));

const deletionFixture = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'origamix-page-deletion-'));
  directories.push(directory);
  const database = new ApplicationDatabase(join(directory, 'application.db'));
  const projects = new ProjectRepository(database);
  const service = new ProjectService(projects, templatePath);
  service.registerGrant('grant_delete', directory);
  const project = await service.createProject({
    name: 'Delete',
    code: 'delete',
    directoryGrantId: 'grant_delete',
  });
  const page = await service.createPage(project.id, { name: 'Home', slug: 'home' });
  return { directory, database, projects, service, project, page };
};

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('Project page persistence and recovery', () => {
  it('keeps project roles unique, preserves layout, and recovers a manifest write without replaying it', async () => {
    const { database, project, page, service, projects } = await deletionFixture();
    try {
      const before = await service.getPageRoles(project.id);
      const input = {
        projectId: project.id,
        clientRequestId: 'roles_recovery',
        expectedManifestHash: before.manifestHash,
        page: { pageId: page.id, name: 'Login' },
        roles: {
          assignments: { login: page.id },
        },
      };
      const write = ProjectManifestStore.prototype.writeManifest;
      const injected = vi
        .spyOn(ProjectManifestStore.prototype, 'writeManifest')
        .mockImplementationOnce(async function (this: ProjectManifestStore, path, manifest) {
          await write.call(this, path, manifest);
          throw new Error('interrupted after manifest write');
        });
      await expect(service.updatePageRoles(input)).rejects.toThrow('interrupted');
      injected.mockRestore();
      const reopened = new ProjectService(projects, templatePath);
      expect((await reopened.updatePageRoles(input)).roles).toEqual(input.roles);
      expect(projects.getPage(project.id, page.id)?.name).toBe('Login');
      const current = await reopened.getPageRoles(project.id);
      await expect(
        reopened.updatePageRoles({ ...input, clientRequestId: 'roles_stale' }),
      ).rejects.toThrow('已变化');
      await expect(
        reopened.updatePageRoles({
          ...input,
          clientRequestId: 'roles_invalid',
          expectedManifestHash: current.manifestHash,
          roles: { ...input.roles, assignments: { login: page.id, home: page.id } },
        }),
      ).rejects.toThrow('一一对应');
      const customRole = {
        ...input,
        clientRequestId: 'roles_custom',
        expectedManifestHash: current.manifestHash,
        roles: { assignments: { login: page.id, settings: page.id } },
      };
      await expect(reopened.updatePageRoles(customRole)).rejects.toThrow('配置无效');
      await expect(
        reopened.updatePageRoles({ ...input, projectId: 'project_other' }),
      ).rejects.toThrow();
      await reopened.renameProject(project.id, 'Renamed');
      await reopened.updatePageRoles(input);
      expect(projects.getProject(project.id)?.name).toBe('Renamed');
      await reopened.deletePage(project.id, page.id);
      expect((await reopened.getPageRoles(project.id)).roles.assignments).toEqual({});
      const empty = await reopened.getPageRoles(project.id);
      const home = await reopened.createPage(project.id, {
        name: 'Home',
        slug: 'new-home',
        role: 'home',
        expectedManifestHash: empty.manifestHash,
      });
      expect((await reopened.getPageRoles(project.id)).roles.assignments).toEqual({
        home: home.id,
      });
      await expect(
        reopened.createPage(project.id, {
          name: 'Stale',
          slug: 'stale',
          role: 'home',
          expectedManifestHash: empty.manifestHash,
        }),
      ).rejects.toThrow('已变化');
      const latest = await reopened.getPageRoles(project.id);
      const createEntry = ProjectSourceService.prototype.createPageEntry;
      vi.spyOn(ProjectSourceService.prototype, 'createPageEntry').mockImplementationOnce(
        async function (this: ProjectSourceService, ...args) {
          await createEntry.apply(this, args);
          await new ProjectManifestStore().renameProject(project.path, 'External change');
        },
      );
      await expect(
        reopened.createPage(project.id, {
          name: 'Conflict',
          slug: 'conflict',
          role: 'home',
          expectedManifestHash: latest.manifestHash,
        }),
      ).rejects.toThrow('已变化');
      expect((await reopened.getPageRoles(project.id)).roles.assignments).toEqual({
        home: home.id,
      });
      await expect(access(join(project.path, 'src/pages/conflict'))).rejects.toThrow();
      expect(projects.listPages(project.id)).toHaveLength(1);
    } finally {
      database.close();
    }
  });

  it('waits for an admitted Working write before deletion and rejects new page activity during cleanup', async () => {
    const { database, project, page, service } = await deletionFixture();
    const release = deferred(),
      entered = deferred();
    try {
      const pageRef = {
        projectPath: project.path,
        pageId: page.id,
        slug: page.slug,
        relativePath: page.relativePath,
      };
      const working = await getWorkingSchemaState(pageRef);
      const written = vi.fn();
      const removed = vi.spyOn(ProjectSourceService.prototype, 'removePageDirectory');
      const write = updateWorkingSchema(
        pageRef,
        {
          baseWorkingVersion: working.workingVersion,
          schema: {
            ...working.schema,
            elements: {
              ...working.schema.elements,
              element_root: { ...working.schema.elements.element_root!, props: { padding: 22 } },
            },
          },
        },
        {
          beforeWrite: async () => {
            entered.resolve();
            await release.promise;
          },
          afterWorkingStage: (stage) => {
            if (stage === 'working') written();
          },
        },
      );
      await entered.promise;
      const deletion = service.deletePage(project.id, page.id);
      // The queued project owner marks admission closed before waiting on the retained writer.
      await Promise.resolve();
      await expect(getWorkingSchemaState(pageRef)).rejects.toThrow('删除或升级');
      expect(removed).not.toHaveBeenCalled();
      release.resolve();
      await write;
      await deletion;
      expect(written.mock.invocationCallOrder[0]).toBeLessThan(
        removed.mock.invocationCallOrder[0]!,
      );
    } finally {
      release.resolve();
      database.close();
    }
  });
  // Destructive authorization and interruption are not covered by creation or HTTP success checks.
  it.each(['src', 'parent', 'leaf', 'metadata'] as const)(
    'rejects a symlink at %s before deleting source or retained drafts',
    async (boundary) => {
      const fixture = await deletionFixture();
      const { directory, database, project, page, service } = fixture;
      try {
        const relative = {
          src: 'src',
          parent: 'src/pages',
          leaf: 'src/pages/home',
          metadata: `.origamix/pages/${page.id}`,
        }[boundary];
        const original = join(project.path, relative),
          external = join(directory, 'external');
        await rename(original, external);
        await symlink(external, original);
        const manifestPath = join(project.path, 'origamix.project.json');
        const before = await readFile(manifestPath, 'utf8');
        const sentinel = join(
          external,
          {
            src: 'pages/home/schema.json',
            parent: 'home/schema.json',
            leaf: 'schema.json',
            metadata: 'working.json',
          }[boundary],
        );
        const contents = await readFile(sentinel, 'utf8');
        await expect(service.deletePage(project.id, page.id)).rejects.toThrow('符号链接');
        expect(await readFile(sentinel, 'utf8')).toBe(contents);
        expect(await readFile(manifestPath, 'utf8')).toBe(before);
        expect(fixture.projects.getPage(project.id, page.id)).toBeDefined();
        await access(join(project.path, 'src/pages/home/schema.json'));
      } finally {
        database.close();
      }
    },
  );

  it.each(['files', 'database'] as const)(
    'resumes explicit deletion after %s failure and never deletes a replacement page',
    async (stage) => {
      const { database, projects, project, page, service } = await deletionFixture();
      try {
        const deleteRecord = projects.deletePageRecord.bind(projects);
        const failed =
          stage === 'files'
            ? vi
                .spyOn(ProjectSourceService.prototype, 'removePageDirectory')
                .mockRejectedValueOnce(new Error('interrupted deletion'))
            : vi.spyOn(projects, 'deletePageRecord').mockImplementationOnce((...args) => {
                deleteRecord(...args);
                throw new Error('interrupted deletion');
              });
        await expect(service.deletePage(project.id, page.id)).rejects.toThrow(
          'interrupted deletion',
        );
        failed.mockRestore();
        const pageRef = {
          projectPath: project.path,
          pageId: page.id,
          slug: page.slug,
          relativePath: page.relativePath,
        };
        await expect(getWorkingSchemaState(pageRef)).rejects.toThrow('删除流程');
        // Recreate the service/index as reopening the project would; no cleanup is auto-resumed.
        const reopened = new ProjectService(projects, templatePath);
        await reopened.reconcile(project.path);
        let replacement;
        if (stage === 'database')
          replacement = await reopened.createPage(project.id, { name: 'New home', slug: 'home' });
        await reopened.deletePage(project.id, page.id);
        replacement ??= await reopened.createPage(project.id, { name: 'New home', slug: 'home' });
        await reopened.deletePage(project.id, page.id);
        expect(projects.getPage(project.id, replacement.id)).toBeDefined();
        expect(projects.getPage(project.id, page.id)).toBeUndefined();
        await access(join(project.path, replacement.relativePath, 'schema.json'));
        expect(
          JSON.parse(await readFile(join(project.path, 'origamix.project.json'), 'utf8')).pages,
        ).toEqual([expect.objectContaining({ pageId: replacement.id })]);
        expect(
          JSON.parse(
            await readFile(
              join(project.path, '.origamix/page-deletions', `${page.id}.json`),
              'utf8',
            ),
          ).state,
        ).toBe('completed');
      } finally {
        database.close();
      }
    },
  );

  it('serializes page creation and keeps the page index aligned with an empty manifest', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-page-index-'));
    directories.push(directory);
    const database = new ApplicationDatabase(join(directory, 'origamix.db'));
    const projects = new ProjectRepository(database);
    const service = new ProjectService(projects, templatePath);
    service.registerGrant('grant_project', directory);
    const project = await service.createProject({
      name: '页面索引',
      code: 'page-index',
      directoryGrantId: 'grant_project',
    });

    await Promise.all([
      service.createPage(project.id, { name: '页面 A', slug: 'page-a' }),
      service.createPage(project.id, { name: '页面 B', slug: 'page-b' }),
    ]);
    expect(projects.listPages(project.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: 'page-a' }),
        expect.objectContaining({ slug: 'page-b' }),
      ]),
    );

    const page = projects.listPages(project.id)[0]!;
    await Promise.all([
      service.renameProject(project.id, '重命名项目'),
      service.renamePage(project.id, page.id, '重命名页面'),
    ]);
    const renamed = JSON.parse(await readFile(join(project.path, 'origamix.project.json'), 'utf8'));
    expect(renamed.name).toBe('重命名项目');
    expect(renamed.pages.find((item: { pageId: string }) => item.pageId === page.id).name).toBe(
      '重命名页面',
    );
    expect(projects.getPage(project.id, page.id)?.name).toBe('重命名页面');

    const manifestPath = join(project.path, 'origamix.project.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    await writeFile(manifestPath, `${JSON.stringify({ ...manifest, pages: [] }, null, 2)}\n`);
    await service.reconcile(project.path);
    expect(projects.listPages(project.id)).toEqual([]);
    database.close();
  });

  it('removes page files when creation fails before the manifest is committed', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-page-rollback-'));
    directories.push(directory);
    const database = new ApplicationDatabase(join(directory, 'origamix.db'));
    const projects = new ProjectRepository(database);
    const apply = new ProjectApplyService(projects);
    const service = new ProjectService(projects, templatePath, apply);
    service.registerGrant('grant_project', directory);
    const project = await service.createProject({
      name: '页面回滚',
      code: 'page-rollback',
      directoryGrantId: 'grant_project',
    });
    vi.spyOn(apply, 'initializeTarget').mockRejectedValueOnce(new Error('simulated write failure'));

    await expect(
      service.createPage(project.id, { name: '失败页面', slug: 'failed-page' }),
    ).rejects.toThrow('simulated write failure');
    await expect(access(join(project.path, 'src', 'pages', 'failed-page'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(
      JSON.parse(await readFile(join(project.path, 'origamix.project.json'), 'utf8')).pages,
    ).toEqual([]);
    database.close();
  });

  it('does not remove the winning page during concurrent creation of the same slug', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-page-same-slug-'));
    directories.push(directory);
    const database = new ApplicationDatabase(join(directory, 'origamix.db'));
    const projects = new ProjectRepository(database);
    const service = new ProjectService(projects, templatePath);
    service.registerGrant('grant_project', directory);
    const project = await service.createProject({
      name: '同名页面',
      code: 'same-slug',
      directoryGrantId: 'grant_project',
    });

    const results = await Promise.allSettled([
      service.createPage(project.id, { name: '页面 A', slug: 'same-page' }),
      service.createPage(project.id, { name: '页面 B', slug: 'same-page' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const manifest = JSON.parse(
      await readFile(join(project.path, 'origamix.project.json'), 'utf8'),
    ) as { pages: Array<{ slug: string }> };
    expect(manifest.pages).toEqual([expect.objectContaining({ slug: 'same-page' })]);
    await access(join(project.path, 'src', 'pages', 'same-page', 'schema.json'));
    database.close();
  });

  it('preserves a manifest-committed page and rebuilds its failed local index', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-page-recovery-'));
    directories.push(directory);
    const database = new ApplicationDatabase(join(directory, 'origamix.db'));
    const projects = new ProjectRepository(database);
    const service = new ProjectService(projects, templatePath);
    service.registerGrant('grant_project', directory);
    const project = await service.createProject({
      name: '页面恢复',
      code: 'page-recovery',
      directoryGrantId: 'grant_project',
    });
    const reconcile = vi.spyOn(projects, 'reconcile').mockImplementationOnce(() => {
      throw new Error('simulated index failure');
    });

    await expect(
      service.createPage(project.id, { name: '已落盘页面', slug: 'durable-page' }),
    ).rejects.toThrow('页面已创建，但本地索引更新失败');
    reconcile.mockRestore();
    const manifest = JSON.parse(
      await readFile(join(project.path, 'origamix.project.json'), 'utf8'),
    ) as { pages: Array<{ pageId: string; slug: string }> };
    expect(manifest.pages).toEqual([
      expect.objectContaining({ pageId: expect.any(String), slug: 'durable-page' }),
    ]);
    await access(join(project.path, 'src', 'pages', 'durable-page', 'schema.json'));

    await service.reconcile(project.path);
    expect(projects.listPages(project.id)).toEqual([
      expect.objectContaining({ id: manifest.pages[0]!.pageId, slug: 'durable-page' }),
    ]);
    database.close();
  });
});

it('reconciles the project without opening pages and imports only the page requested later', async () => {
  const { getWorkingSchemaState } = await import('../../src/schema/schema-service');
  const directory = await mkdtemp(join(tmpdir(), 'origamix-lazy-page-'));
  directories.push(directory);
  const database = new ApplicationDatabase(join(directory, 'application.db'));
  try {
    const projects = new ProjectRepository(database);
    const service = new ProjectService(projects, templatePath);
    service.registerGrant('lazy_grant', directory);
    const project = await service.createProject({
      name: 'Lazy',
      code: 'lazy',
      directoryGrantId: 'lazy_grant',
    });
    const first = await service.createPage(project.id, { name: 'First', slug: 'first' });
    const second = await service.createPage(project.id, { name: 'Second', slug: 'second' });
    await rm(join(project.path, '.origamix'), { recursive: true, force: true });
    await service.reconcile(project.path);
    await expect(access(join(project.path, '.origamix/pages'))).rejects.toThrow();
    const opened = await getWorkingSchemaState({
      projectPath: project.path,
      pageId: first.id,
      slug: first.slug,
      relativePath: first.relativePath,
    });
    expect(opened.workingHash).toBe(opened.savedSchemaHash);
    await expect(access(join(project.path, '.origamix/pages', second.id))).rejects.toThrow();
    expect(
      JSON.parse(await readFile(join(project.path, first.relativePath, 'schema.json'), 'utf8'))
        .extensions.origamix.schemaVersion,
    ).toBe(opened.schema.extensions.origamix.schemaVersion);
  } finally {
    database.close();
  }
});

it('initializes a project manifest when opening an uninitialized directory', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'origamix-imported-project-'));
  directories.push(directory);
  const database = new ApplicationDatabase(join(directory, 'origamix.db'));
  const projects = new ProjectRepository(database);
  const service = new ProjectService(projects, templatePath);
  service.registerGrant('grant_existing', directory);

  const pending = await service.openProject({
    directoryGrantId: 'grant_existing',
    name: '导入项目',
    code: 'imported-project',
  });
  expect(pending.status).toBe('initialization_required');
  if (pending.status !== 'initialization_required') throw new Error('expected inspection');
  await expect(readFile(join(directory, 'origamix.project.json'), 'utf8')).rejects.toMatchObject({
    code: 'ENOENT',
  });
  const initialization = () =>
    service.openProject({
      directoryGrantId: 'grant_existing',
      name: '导入项目',
      code: 'imported-project',
      initializeIfNeeded: true,
    });
  const attempts = await Promise.allSettled([initialization(), initialization()]);
  expect(attempts.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
  expect(attempts.filter((item) => item.status === 'rejected')).toHaveLength(1);
  const accepted = attempts.find((item) => item.status === 'fulfilled');
  if (!accepted || accepted.status !== 'fulfilled') throw new Error('expected initialized project');
  const opened = accepted.value;
  if (opened.status !== 'opened') throw new Error('expected opened project');
  const project = opened.project;
  const manifest = JSON.parse(await readFile(join(directory, 'origamix.project.json'), 'utf8')) as {
    name: string;
    code: string;
  };

  expect(manifest).toMatchObject({
    name: '导入项目',
    code: 'imported-project',
    pageDirectory: 'pages',
  });
  expect(project.name).toBe('导入项目');
  expect(manifest).toMatchObject({
    framework: 'react',
    materialSet: { id: 'official-antd', version: '1.0.0' },
    pages: [],
  });
  expect(manifest).toMatchObject({ runtime: 'external', layout: { enabled: false } });
  await expect(access(join(directory, 'src', 'router.ts'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
  await expect(access(join(directory, 'vite.config.ts'))).rejects.toMatchObject({ code: 'ENOENT' });
  await expect(service.getSettings(project.id)).rejects.toThrow('不支持');
  await expect(service.getRouting(project.id)).rejects.toThrow('自行管理');
  database.close();
});

// New project initialization and runtime-config concurrency cannot be proved by page edit tests.
// Settings references guard page deletion; a completed write is recoverable after a lost response.
it('saves project settings without layout drafts and preserves configuration on conflict or interruption', async () => {
  const { database, service, project, page, projects } = await deletionFixture();
  try {
    const before = await service.getSettings(project.id);
    expect(before.layout.initialVariant).toBe('mix');
    const update = {
      name: 'Updated project',
      projectId: project.id,
      expectedManifestHash: before.manifestHash,
      layout: { enabled: true, initialVariant: 'mix' as const },
      routing: { mode: 'hash' as const, basePath: '/admin/' },
      shell: {
        ...before.shell,
        homePageId: page.id,
        notFoundPageId: page.id,
        navigation: [
          { id: 'group', title: '管理', hidden: false },
          { id: 'home', parentId: 'group', title: '', pageId: page.id, hidden: false },
        ],
      },
    };
    const original = ProjectManifestStore.prototype.writeManifest;
    const injected = vi
      .spyOn(ProjectManifestStore.prototype, 'writeManifest')
      .mockImplementationOnce(async function (this: ProjectManifestStore, path, manifest) {
        await original.call(this, path, manifest);
        throw new Error('interrupted settings write');
      });
    await expect(service.updateSettings(update)).rejects.toThrow('interrupted');
    injected.mockRestore();
    const reopened = new ProjectService(projects, templatePath);
    const saved = await reopened.updateSettings(update);
    expect(saved.shell).toEqual(update.shell);
    expect(saved.name).toBe(update.name);
    expect(projects.listProjects().find((item) => item.id === project.id)?.name).toBe(update.name);
    await expect(access(join(project.path, '.origamix/layout/working.json'))).rejects.toThrow();
    await expect(access(join(project.path, 'src/origamix-layout/schema.json'))).rejects.toThrow();
    await expect(
      reopened.updateSettings({ ...update, shell: { ...update.shell, title: 'stale' } }),
    ).rejects.toThrow('已被修改');
    await expect(
      reopened.updateSettings({
        ...update,
        expectedManifestHash: saved.manifestHash,
        shell: { ...update.shell, homePageId: 'page_missing' },
      }),
    ).rejects.toThrow('页面不存在');
    await expect(
      reopened.updateSettings({
        ...update,
        expectedManifestHash: saved.manifestHash,
        shell: {
          ...update.shell,
          navigation: [{ id: 'cycle', parentId: 'cycle', title: 'cycle', hidden: false }],
        },
      }),
    ).rejects.toThrow('循环');
    await expect(
      reopened.updateSettings({ ...update, projectId: 'project_foreign' }),
    ).rejects.toThrow();
    await expect(reopened.deletePage(project.id, page.id)).rejects.toThrow('项目设置引用');
    await reopened.renamePage(project.id, page.id, 'Renamed');
    const renamed = await reopened.getSettings(project.id);
    expect(renamed.shell.navigation?.[1]?.pageId).toBe(page.id);
    const disabled = await reopened.updateSettings({
      ...update,
      expectedManifestHash: renamed.manifestHash,
      layout: { ...update.layout, enabled: false },
    });
    expect(disabled.shell).toEqual(update.shell);
    await reopened.updateSettings({
      ...update,
      expectedManifestHash: disabled.manifestHash,
      shell: { title: '', logo: '', navigation: [], standalonePageIds: [] },
    });
    await reopened.deletePage(project.id, page.id);
  } finally {
    database.close();
  }
});
