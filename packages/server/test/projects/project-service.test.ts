import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApplicationDatabase } from '../../database/database';
import { ProjectRepository } from '../../projects/project-repository';
import { ProjectService } from '../../projects/project-service';
import { ProjectApplyService } from '../../schema/project-apply-service';

const directories: string[] = [];
const templatePath = fileURLToPath(new URL('../../../template', import.meta.url));

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('Project page persistence and recovery', () => {
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
