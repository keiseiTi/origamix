import {
  mkdtemp,
  writeFile,
  readFile,
  readdir,
  rm,
  symlink,
  rename,
  mkdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { type LayoutOperationsRequest } from '@origamix/shared';
import { LayoutService } from '../../src/layout/layout-service';
import { withExclusiveProjectActivity } from '../../src/projects/project-activity';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
const fixture = async () => {
  const path = await mkdtemp(join(tmpdir(), 'origamix-layout-'));
  directories.push(path);
  const manifest = {
    projectId: 'project_test',
    name: '测试项目',
    framework: 'react',
    materialSet: { id: 'official-antd', version: '1.0.0' },
    pageDirectory: 'pages',
    pages: [{ pageId: 'page_home', name: '首页', slug: 'home' }],
    layout: { enabled: true },
  };
  await writeFile(join(path, 'origamix.project.json'), JSON.stringify(manifest));
  await mkdir(join(path, 'src', 'pages', 'home'), { recursive: true });
  const target = join(path, 'src', 'pages', 'home', 'schema.json');
  await writeFile(target, '{"untouched":true}');
  const projects = {
    getProject: (id: string) =>
      id === 'project_test'
        ? { id, path, status: 0, name: '测试项目', createdAt: '', lastOpenedAt: '' }
        : undefined,
  };
  return {
    path,
    manifest,
    target,
    service: new LayoutService(projects),
    restart: () => new LayoutService(projects),
  };
};
const create = (): LayoutOperationsRequest => ({
  projectId: 'project_test',
  baseWorkingVersion: 1,
  clientRequestId: 'request_create',
  operations: [
    { operation: 'updateElementProps', elementId: 'layout', set: { contentPadding: 8 } },
    {
      operation: 'addElement',
      elementId: 'content',
      parentId: 'layout__header',
      element: { type: 'text', props: { text: 'Custom header' } },
    },
  ],
});

// New core-flow owner: page scenarios cannot cover project-scoped layout persistence.
it('retains one project layout draft, saves only explicitly, restores without a checkpoint or target write', async () => {
  const { service, restart, target } = await fixture();
  const initial = await service.getWorking('project_test');
  expect(initial.revisionId).toBeNull();
  expect((await service.listRevisions('project_test')).revisions).toEqual([]);
  const draft = await service.applyOperations(create());
  expect(draft.workingVersion).toBe(2);
  expect(draft.document.schema.elements.layout!.type).toBe('Layout');
  expect(await restart().getWorking('project_test')).toEqual(draft);
  expect(await service.applyOperations(create())).toEqual(draft);
  expect((await service.listRevisions('project_test')).revisions).toHaveLength(0);
  const saved = await service.saveRevision('project_test', draft.workingVersion);
  expect(saved.revisionId).toMatch(/^revision_/);
  expect(await service.saveRevision('project_test', saved.workingVersion)).toEqual(saved);
  const edited = await service.applyOperations({
    projectId: 'project_test',
    baseWorkingVersion: saved.workingVersion,
    clientRequestId: 'edit',
    operations: [
      { operation: 'updateElementProps', elementId: 'layout', set: { contentPadding: 24 } },
    ],
  });
  const changedRegions = await service.applyOperations({
    projectId: 'project_test',
    baseWorkingVersion: edited.workingVersion,
    clientRequestId: 'regions',
    operations: [
      {
        operation: 'updateElementProps',
        elementId: 'layout',
        set: { variant: 'side-top', headerEnabled: false, footerEnabled: true },
      },
    ],
  });
  expect(changedRegions.workingVersion).toBe(edited.workingVersion + 1);
  expect(changedRegions.document.schema.layout.structure.layout).toEqual([
    'layout__sider',
    'layout__body',
  ]);
  expect(changedRegions.document.schema.elements.layout__header!.props.enabled).toBe(false);
  expect(changedRegions.document.schema.elements.content).toEqual(
    edited.document.schema.elements.content,
  );
  expect(changedRegions.document.schema.elements.outlet).toEqual(
    edited.document.schema.elements.outlet,
  );
  expect((await service.listRevisions('project_test')).revisions).toHaveLength(1);
  const savedAgain = await service.saveRevision('project_test', changedRegions.workingVersion);
  const restored = await service.restoreRevision(
    'project_test',
    saved.revisionId!,
    savedAgain.workingVersion,
  );
  expect(restored.document).toEqual(saved.document);
  expect(restored.revisionId).toBe(savedAgain.revisionId);
  expect(restored.workingHash).not.toBe(restored.savedSchemaHash);
  expect((await service.listRevisions('project_test')).revisions).toHaveLength(2);
  expect(await readFile(target, 'utf8')).toBe('{"untouched":true}');
});

it('rejects stale, invalid and foreign edits atomically and serializes concurrent writers', async () => {
  const { service } = await fixture();
  const draft = await service.applyOperations(create());
  const mutate = (operations: LayoutOperationsRequest['operations'], clientRequestId = 'edit') =>
    service.applyOperations({
      projectId: 'project_test',
      baseWorkingVersion: draft.workingVersion,
      clientRequestId,
      operations,
    });
  await expect(service.getWorking('project_other')).rejects.toMatchObject({ statusCode: 404 });
  await expect(
    service.applyOperations({ ...create(), clientRequestId: 'stale' }),
  ).rejects.toMatchObject({ statusCode: 409 });
  await expect(
    service.applyOperations({
      ...create(),
      operations: [
        { operation: 'updateElementProps', elementId: 'layout', set: { contentPadding: 16 } },
      ],
    }),
  ).rejects.toThrow('请求身份');
  await expect(
    mutate([
      { operation: 'updateElementProps', elementId: 'layout', set: { contentPadding: 32 } },
      { operation: 'removeElement', elementId: 'outlet' },
    ]),
  ).rejects.toThrow('INVALID_PAGE_OUTLET');
  await expect(
    mutate([
      { operation: 'updateElementProps', elementId: 'layout', set: { contentPadding: 'invalid' } },
    ]),
  ).rejects.toThrow('INVALID_MATERIAL_PROPS');
  await expect(
    mutate([
      {
        operation: 'addElement',
        elementId: 'unknown',
        element: { type: 'Unknown', props: {} },
        parentId: 'layout__header',
      },
    ]),
  ).rejects.toThrow('UNKNOWN_MATERIAL');
  await expect(
    mutate(
      [{ operation: 'removeElement', elementId: 'layout__header', removeDescendants: true }],
      'remove-region',
    ),
  ).rejects.toThrow('不能删除内部区域');
  await expect(
    mutate(
      [{ operation: 'moveElement', elementId: 'layout__sider', parentId: 'layout__header' }],
      'move-region',
    ),
  ).rejects.toThrow('不能移动内部区域');
  expect(await service.getWorking('project_test')).toEqual(draft);
  const competing = await Promise.allSettled([
    mutate(
      [{ operation: 'updateElementProps', elementId: 'layout', set: { contentPadding: 10 } }],
      'a',
    ),
    mutate(
      [{ operation: 'updateElementProps', elementId: 'layout', set: { contentPadding: 20 } }],
      'b',
    ),
  ]);
  expect(competing.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(competing.filter((result) => result.status === 'rejected')).toHaveLength(1);
  const beforeFallback = await service.getWorking('project_test');
  const candidate = structuredClone(beforeFallback.document.schema);
  candidate.elements.content = { type: 'text', props: { text: 'Full candidate update' } };
  const updated = await service.updateWorking({
    projectId: 'project_test',
    baseWorkingVersion: beforeFallback.workingVersion,
    clientRequestId: 'editor-candidate',
    schema: candidate,
  });
  expect(updated.document.schema).toEqual(candidate);
  expect(updated.revisionId).toBeNull();
  await expect(
    service.updateWorking({
      projectId: 'project_test',
      baseWorkingVersion: beforeFallback.workingVersion,
      clientRequestId: 'stale-candidate',
      schema: candidate,
    }),
  ).rejects.toMatchObject({ statusCode: 409 });
  const invalid = structuredClone(candidate);
  delete invalid.elements.content;
  await expect(
    service.updateWorking({
      projectId: 'project_test',
      baseWorkingVersion: updated.workingVersion,
      clientRequestId: 'invalid-candidate',
      schema: invalid,
    }),
  ).rejects.toThrow('INVALID_LAYOUT_SCHEMA');
  expect(await service.getWorking('project_test')).toEqual(updated);
});

it.each(['prepared', 'revision', 'working'] as const)(
  'recovers interrupted explicit save at %s without duplicate revisions or replay',
  async (stage) => {
    const { service, restart } = await fixture();
    const draft = await service.applyOperations(create());
    await expect(
      service.saveRevision('project_test', draft.workingVersion, {
        afterStage: (current) => {
          if (current === stage) throw new Error('interrupted');
        },
      }),
    ).rejects.toThrow('interrupted');
    const recovered = await restart().getWorking('project_test');
    expect(recovered.document).toEqual(draft.document);
    expect(recovered.workingVersion).toBe(draft.workingVersion);
    const saved = await restart().saveRevision('project_test', recovered.workingVersion);
    expect((await restart().listRevisions('project_test')).revisions).toHaveLength(1);
    expect(saved.document).toEqual(draft.document);
  },
);

it('rejects metadata symlinks, wrong ownership, incompatible documents and lifecycle races', async () => {
  const { service, path } = await fixture();
  const draft = await service.applyOperations(create());
  let signalStarted!: () => void;
  let releaseLease!: () => void;
  const started = new Promise<void>((resolve) => {
    signalStarted = resolve;
  });
  const release = new Promise<void>((resolve) => {
    releaseLease = resolve;
  });
  const lease = withExclusiveProjectActivity(path, async () => {
    signalStarted();
    await release;
  });
  await started;
  try {
    await expect(service.getWorking('project_test')).rejects.toMatchObject({ statusCode: 409 });
  } finally {
    releaseLease();
    await lease;
  }
  const working = join(path, '.origamix', 'layout', 'working.json');
  const original = await readFile(working, 'utf8');
  const moved = join(path, 'retained.json');
  await rename(working, moved);
  await symlink(moved, working);
  await expect(service.getWorking('project_test')).rejects.toThrow('符号链接');
  expect(await readFile(moved, 'utf8')).toBe(original);
  await rm(working);
  await rename(moved, working);
  for (const document of [
    { ...draft.document, projectId: 'project_other' },
    { ...draft.document, schemaVersion: '2.0.0' },
  ]) {
    await writeFile(working, JSON.stringify({ ...JSON.parse(original), document }));
    await expect(service.getWorking('project_test')).rejects.toMatchObject({ statusCode: 422 });
    expect(await readFile(working, 'utf8')).toContain(JSON.stringify(document));
  }
  await writeFile(working, original);
  expect(await service.getWorking('project_test')).toEqual(draft);
  expect(await readdir(join(path, '.origamix', 'layout'))).not.toContain('revisions');
});

it('enforces manifest enablement without resetting the retained draft or rewriting the manifest', async () => {
  const { service, path, manifest } = await fixture();
  const draft = await service.applyOperations(create());
  const workingPath = join(path, '.origamix', 'layout', 'working.json');
  const original = await readFile(workingPath, 'utf8');
  for (const layout of [undefined, { enabled: false }]) {
    const source = JSON.stringify({ ...manifest, layout });
    await writeFile(join(path, 'origamix.project.json'), source);
    await expect(service.getWorking('project_test')).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      service.applyOperations({
        ...create(),
        baseWorkingVersion: draft.workingVersion,
        clientRequestId: 'disabled',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await readFile(workingPath, 'utf8')).toBe(original);
    expect(await readFile(join(path, 'origamix.project.json'), 'utf8')).toBe(source);
  }
  await writeFile(join(path, 'origamix.project.json'), JSON.stringify(manifest));
  expect(await service.getWorking('project_test')).toEqual(draft);
});
