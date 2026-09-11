import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { ApplicationDatabase } from '../database/database';
import { ProjectRepository } from '../repositories/project-repository';
import { commitSchema, getSchema, hashSchema } from './schema-service';
import { ProjectApplyService } from './project-apply-service';
import { ProjectService } from './project-service';

const templatePath = fileURLToPath(new URL('../../template', import.meta.url));
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true })));
});

const setup = async () => {
  const parent = await mkdtemp(join(tmpdir(), 'origamix-apply-'));
  directories.push(parent);
  const database = new ApplicationDatabase(join(parent, 'app.db'));
  const projects = new ProjectRepository(database);
  const projectService = new ProjectService(projects, templatePath);
  projectService.registerGrant('grant', parent);
  const project = await projectService.createProject({
    name: 'Apply test',
    code: 'apply-test',
    directoryGrantId: 'grant',
  });
  const page = await projectService.createPage(project.id, {
    name: 'Customers',
    slug: 'customers',
  });
  return { database, projects, project, page, apply: new ProjectApplyService(projects) };
};

describe('ProjectApplyService', () => {
  it('rejects request IDs that could escape the receipt directory', async () => {
    const fixture = await setup();
    const current = await getSchema({
      projectPath: fixture.project.path,
      pageId: fixture.page.id,
      slug: fixture.page.slug,
    });
    await expect(
      fixture.apply.apply(fixture.project.id, fixture.page.id, {
        expectedRevisionId: current.revisionId,
        clientRequestId: '../../../outside',
      }),
    ).rejects.toThrow('应用请求 ID 无效');
    fixture.database.close();
  });

  it('uses the apply target writer when initializing a page target', async () => {
    const fixture = await setup();
    const target = join(fixture.project.path, fixture.page.relativePath, 'schema.json');
    const current = await getSchema({
      projectPath: fixture.project.path,
      pageId: fixture.page.id,
      slug: fixture.page.slug,
    });
    await writeFile(
      target,
      JSON.stringify({ ...current.schema, flows: { stale: { nodes: [], edges: [] } } }),
    );

    await fixture.apply.initializeTarget(
      {
        projectPath: fixture.project.path,
        pageId: fixture.page.id,
        slug: fixture.page.slug,
      },
      current.schema,
    );

    expect(JSON.parse(await readFile(target, 'utf8'))).toEqual(current.schema);
    fixture.database.close();
  });

  it('keeps target schema unchanged until an explicit idempotent apply', async () => {
    const fixture = await setup();
    const target = join(fixture.project.path, fixture.page.relativePath, 'schema.json');
    const before = await readFile(target, 'utf8');
    const current = await getSchema({
      projectPath: fixture.project.path,
      pageId: fixture.page.id,
      slug: fixture.page.slug,
    });
    const changed = await commitSchema(
      { projectPath: fixture.project.path, pageId: fixture.page.id, slug: fixture.page.slug },
      {
        changeSetId: 'change_apply_test',
        pageId: fixture.page.id,
        baseRevisionId: current.revisionId,
        source: { kind: 'user' },
        createdAt: new Date().toISOString(),
        operation: 'updateElementProps',
        elementId: 'element_root',
        props: { padding: 24 },
      },
    );
    expect(await readFile(target, 'utf8')).toBe(before);
    expect((await fixture.apply.getState(fixture.project.id, fixture.page.id)).status).toBe(
      'pending',
    );
    const first = await fixture.apply.apply(fixture.project.id, fixture.page.id, {
      expectedRevisionId: changed.revisionId,
      clientRequestId: 'request_apply',
    });
    const workingPath = join(
      fixture.project.path,
      '.origamix',
      'pages',
      fixture.page.id,
      'working.json',
    );
    const working = JSON.parse(await readFile(workingPath, 'utf8')) as Record<string, unknown>;
    await writeFile(workingPath, JSON.stringify({ ...working, baselineHash: 'stale-baseline' }));
    const second = await fixture.apply.apply(fixture.project.id, fixture.page.id, {
      expectedRevisionId: changed.revisionId,
      clientRequestId: 'request_apply',
    });
    expect(second).toEqual(first);
    expect(JSON.parse(await readFile(target, 'utf8'))).toMatchObject({
      elements: { element_root: { props: { padding: 24 } } },
    });
    expect((await fixture.apply.getState(fixture.project.id, fixture.page.id)).status).toBe(
      'in_sync',
    );
    fixture.database.close();
  });

  it('serializes concurrent requests with the same ID into one stable result', async () => {
    const fixture = await setup();
    const ref = {
      projectPath: fixture.project.path,
      pageId: fixture.page.id,
      slug: fixture.page.slug,
    };
    const current = await getSchema(ref);
    const changed = await commitSchema(ref, {
      changeSetId: 'change_concurrent_apply',
      pageId: fixture.page.id,
      baseRevisionId: current.revisionId,
      source: { kind: 'user' },
      createdAt: new Date().toISOString(),
      operation: 'updateElementProps',
      elementId: 'element_root',
      props: { padding: 30 },
    });
    const input = {
      expectedRevisionId: changed.revisionId,
      clientRequestId: 'request_concurrent_apply',
    };
    const [first, second] = await Promise.all([
      fixture.apply.apply(fixture.project.id, fixture.page.id, input),
      fixture.apply.apply(fixture.project.id, fixture.page.id, input),
    ]);
    expect(second).toEqual(first);
    fixture.database.close();
  });

  it('repairs the baseline after interruption following a durable receipt', async () => {
    const fixture = await setup();
    const ref = {
      projectPath: fixture.project.path,
      pageId: fixture.page.id,
      slug: fixture.page.slug,
    };
    const current = await getSchema(ref);
    const changed = await commitSchema(ref, {
      changeSetId: 'change_interrupted_apply',
      pageId: fixture.page.id,
      baseRevisionId: current.revisionId,
      source: { kind: 'user' },
      createdAt: new Date().toISOString(),
      operation: 'updateElementProps',
      elementId: 'element_root',
      props: { padding: 44 },
    });
    const interrupted = new ProjectApplyService(fixture.projects, undefined, {
      afterStage: (stage) => {
        if (stage === 'receipt') throw new Error('simulated process interruption');
      },
    });
    const input = {
      expectedRevisionId: changed.revisionId,
      clientRequestId: 'request_interrupted_apply',
    };
    await expect(interrupted.apply(fixture.project.id, fixture.page.id, input)).rejects.toThrow(
      'simulated process interruption',
    );
    const workingPath = join(
      fixture.project.path,
      '.origamix',
      'pages',
      fixture.page.id,
      'working.json',
    );
    expect(JSON.parse(await readFile(workingPath, 'utf8')).baselineHash).not.toBe(
      hashSchema(changed.schema),
    );
    await expect(fixture.apply.apply(fixture.project.id, fixture.page.id, input)).resolves.toEqual(
      expect.objectContaining({ revisionId: changed.revisionId, status: 'applied' }),
    );
    expect((await fixture.apply.getState(fixture.project.id, fixture.page.id)).status).toBe(
      'in_sync',
    );
    expect(JSON.parse(await readFile(workingPath, 'utf8')).baselineHash).toBe(
      hashSchema(changed.schema),
    );
    fixture.database.close();
  });

  it('refuses to overwrite an externally changed target when a draft exists', async () => {
    const fixture = await setup();
    const ref = {
      projectPath: fixture.project.path,
      pageId: fixture.page.id,
      slug: fixture.page.slug,
    };
    const current = await getSchema(ref);
    const changed = await commitSchema(ref, {
      changeSetId: 'change_conflict_test',
      pageId: fixture.page.id,
      baseRevisionId: current.revisionId,
      source: { kind: 'user' },
      createdAt: new Date().toISOString(),
      operation: 'updateElementProps',
      elementId: 'element_root',
      props: { padding: 24 },
    });
    const target = join(fixture.project.path, fixture.page.relativePath, 'schema.json');
    const external = structuredClone(current.schema);
    external.elements.element_root!.props = { padding: 12 };
    await writeFile(target, JSON.stringify(external));
    await expect(
      fixture.apply.apply(fixture.project.id, fixture.page.id, {
        expectedRevisionId: changed.revisionId,
        clientRequestId: 'request_conflict',
      }),
    ).rejects.toThrow('项目文件已变化');
    expect(JSON.parse(await readFile(target, 'utf8'))).toMatchObject({
      elements: { element_root: { props: { padding: 12 } } },
    });
    fixture.database.close();
  });

  it('reloads a valid external target only after an explicit request', async () => {
    const fixture = await setup();
    const target = join(fixture.project.path, fixture.page.relativePath, 'schema.json');
    const current = await getSchema({
      projectPath: fixture.project.path,
      pageId: fixture.page.id,
      slug: fixture.page.slug,
    });
    const external = structuredClone(current.schema);
    external.elements.element_root!.props = { padding: 36 };
    await writeFile(target, JSON.stringify(external));

    expect((await fixture.apply.getState(fixture.project.id, fixture.page.id)).status).toBe(
      'external_change',
    );
    const reloaded = await fixture.apply.reloadFromProject(fixture.project.id, fixture.page.id);
    expect(reloaded.schema).toEqual(external);
    expect((await fixture.apply.getState(fixture.project.id, fixture.page.id)).status).toBe(
      'in_sync',
    );
    fixture.database.close();
  });

  it('reports a moved or missing target schema instead of recreating it', async () => {
    const fixture = await setup();
    const target = join(fixture.project.path, fixture.page.relativePath, 'schema.json');
    await rm(target);
    const current = await getSchema({
      projectPath: fixture.project.path,
      pageId: fixture.page.id,
      slug: fixture.page.slug,
    });

    await expect(
      fixture.apply.apply(fixture.project.id, fixture.page.id, {
        expectedRevisionId: current.revisionId,
        clientRequestId: 'request_missing_target',
      }),
    ).rejects.toThrow('页面目标 Schema 路径已变化或文件不存在');
    await expect(readFile(target, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    fixture.database.close();
  });

  it('rejects a page directory symlink that leaves the project', async () => {
    const fixture = await setup();
    const pageDirectory = join(fixture.project.path, fixture.page.relativePath);
    const outside = join(dirname(fixture.project.path), 'outside-page');
    const current = await getSchema({
      projectPath: fixture.project.path,
      pageId: fixture.page.id,
      slug: fixture.page.slug,
    });
    await rm(pageDirectory, { recursive: true });
    await mkdir(outside);
    await writeFile(join(outside, 'schema.json'), JSON.stringify(current.schema));
    await symlink(outside, pageDirectory, 'dir');

    await expect(fixture.apply.getState(fixture.project.id, fixture.page.id)).rejects.toThrow(
      '页面目标路径不属于当前项目',
    );
    fixture.database.close();
  });
});
