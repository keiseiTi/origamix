import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { ApplicationDatabase } from '../database/database';
import { ProjectRepository } from '../repositories/project-repository';
import { commitSchema, getSchema } from './schema-service';
import { ProjectApplyService } from './project-apply-service';
import { ProjectService } from './project-service';

const templatePath = fileURLToPath(new URL('../../template', import.meta.url));
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true })));
});

async function setup() {
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
}

describe('ProjectApplyService', () => {
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
});
