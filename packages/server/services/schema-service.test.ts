import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import { commitSchema, getSchema, initializePageSchema, undoSchema } from './schema-service';

const directories: string[] = [];

const schema: OrigamixPageSchema = {
  elements: { element_root: { type: 'container', props: { padding: 8 } } },
  layout: { root: 'element_root', structure: { element_root: [] } },
  flows: {},
  bindElements: [],
  context: { globalVariables: [] },
  extensions: { origamix: { schemaVersion: '1.0' } },
};

const createPageFixture = async (): Promise<{
  projectPath: string;
  pageId: string;
  slug: string;
}> => {
  const projectPath = await mkdtemp(join(tmpdir(), 'origamix-schema-'));
  directories.push(projectPath);
  const pageId = 'page_test';
  const slug = 'test-page';
  const pagePath = join(projectPath, 'src', 'pages', slug);
  await mkdir(pagePath, { recursive: true });
  await writeFile(join(pagePath, 'schema.json'), JSON.stringify(schema));
  await writeFile(
    join(projectPath, 'origamix.project.json'),
    JSON.stringify({
      projectId: 'project_test',
      name: 'Test',
      framework: 'react',
      uiLibrary: 'antd',
      pages: [{ pageId, name: '测试页面', slug }],
    }),
  );
  return { projectPath, pageId, slug };
};

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('Schema Service', () => {
  it('rejects Manifest-invalid Schema before creating a revision', async () => {
    const page = await createPageFixture();
    const invalidSchema: OrigamixPageSchema = {
      ...schema,
      elements: { element_root: { type: 'unknown-material', props: {} } },
    };

    await expect(initializePageSchema(page, invalidSchema)).rejects.toThrow(
      'UNKNOWN_MATERIAL at /elements/element_root/type',
    );
    await expect(
      readdir(join(page.projectPath, '.origamix', 'revisions', page.pageId)),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('commits an update and keeps a revision snapshot', async () => {
    const page = await createPageFixture();
    const initialRevisionId = await initializePageSchema(page, schema);

    const result = await commitSchema(page, {
      changeSetId: 'change_title',
      pageId: page.pageId,
      baseRevisionId: initialRevisionId,
      source: { kind: 'user' },
      createdAt: '2026-08-28T00:00:00.000Z',
      operation: 'updateElementProps',
      elementId: 'element_root',
      props: { padding: 16 },
    });

    expect(result.revisionId).not.toBe(initialRevisionId);
    expect(result.schema.elements.element_root.props.padding).toBe(16);
  });

  it('rejects stale revisions and restores the previous snapshot on undo', async () => {
    const page = await createPageFixture();
    const initialRevisionId = await initializePageSchema(page, schema);
    const updated = await commitSchema(page, {
      changeSetId: 'change_title',
      pageId: page.pageId,
      baseRevisionId: initialRevisionId,
      source: { kind: 'user' },
      createdAt: '2026-08-28T00:00:00.000Z',
      operation: 'updateElementProps',
      elementId: 'element_root',
      props: { padding: 16 },
    });

    await expect(
      commitSchema(page, {
        changeSetId: 'change_stale',
        pageId: page.pageId,
        baseRevisionId: initialRevisionId,
        source: { kind: 'user' },
        createdAt: '2026-08-28T00:00:00.000Z',
        operation: 'updateElementProps',
        elementId: 'element_root',
        props: { padding: 24 },
      }),
    ).rejects.toThrow('页面已更新');

    const undone = await undoSchema(page);
    expect(undone.schema.elements.element_root.props.padding).toBe(8);
    expect((await getSchema(page)).revisionId).toBe(undone.revisionId);
    expect(updated.revisionId).not.toBe(undone.revisionId);
  });

  it('serializes writes per page and makes repeated change sets idempotent', async () => {
    const page = await createPageFixture();
    const initialRevisionId = await initializePageSchema(page, schema);
    const changeSet = {
      changeSetId: 'change_same',
      pageId: page.pageId,
      baseRevisionId: initialRevisionId,
      source: { kind: 'user' as const },
      createdAt: '2026-08-28T00:00:00.000Z',
      operation: 'updateElementProps' as const,
      elementId: 'element_root',
      props: { padding: 10 },
    };
    const [first, repeated] = await Promise.all([
      commitSchema(page, changeSet),
      commitSchema(page, changeSet),
    ]);
    expect(repeated.revisionId).toBe(first.revisionId);
    const revisions = await readdir(join(page.projectPath, '.origamix', 'revisions', page.pageId));
    expect(revisions).toHaveLength(2);

    await expect(commitSchema(page, { ...changeSet, props: { padding: 11 } })).rejects.toThrow(
      '已用于其他请求',
    );
  });

  it('allows only one concurrent write from the same base revision', async () => {
    const page = await createPageFixture();
    const baseRevisionId = await initializePageSchema(page, schema);
    const changes = ['first', 'second'].map((name) =>
      commitSchema(page, {
        changeSetId: `change_${name}`,
        pageId: page.pageId,
        baseRevisionId,
        source: { kind: 'user' as const },
        createdAt: '2026-08-28T00:00:00.000Z',
        operation: 'updateElementProps' as const,
        elementId: 'element_root',
        props: { padding: name === 'first' ? 12 : 13 },
      }),
    );
    const results = await Promise.allSettled(changes);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });

  it.each(['prepared', 'revision', 'schema', 'meta', 'receipt'] as const)(
    'reconciles an interrupted write after the %s stage',
    async (failedStage) => {
      const page = await createPageFixture();
      const baseRevisionId = await initializePageSchema(page, schema);
      const changeSet = {
        changeSetId: `change_failure_${failedStage}`,
        pageId: page.pageId,
        baseRevisionId,
        source: { kind: 'agent' as const, runId: 'run_test' },
        createdAt: '2026-08-28T00:00:00.000Z',
        operation: 'updateElementProps' as const,
        elementId: 'element_root',
        props: { padding: 20 },
      };
      await expect(
        commitSchema(page, changeSet, {
          afterStage(stage) {
            if (stage === failedStage) throw new Error(`interrupt:${stage}`);
          },
        }),
      ).rejects.toThrow(`interrupt:${failedStage}`);

      const recovered = await getSchema(page);
      if (failedStage === 'prepared') {
        expect(recovered.revisionId).toBe(baseRevisionId);
        expect(recovered.schema.elements.element_root.props.padding).toBe(8);
      } else {
        expect(recovered.revisionId).not.toBe(baseRevisionId);
        expect(recovered.schema.elements.element_root.props.padding).toBe(20);
        expect((await commitSchema(page, changeSet)).revisionId).toBe(recovered.revisionId);
      }
      expect(await readdir(join(page.projectPath, '.origamix', 'transactions'))).toEqual([]);
      await getSchema(page);
    },
  );

  it('does not block a different page while one page write is queued', async () => {
    const firstPage = await createPageFixture();
    const secondPage = await createPageFixture();
    const [firstBase, secondBase] = await Promise.all([
      initializePageSchema(firstPage, schema),
      initializePageSchema(secondPage, schema),
    ]);
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const firstCommit = commitSchema(
      firstPage,
      {
        changeSetId: 'change_blocked',
        pageId: firstPage.pageId,
        baseRevisionId: firstBase,
        source: { kind: 'user' },
        createdAt: '2026-08-28T00:00:00.000Z',
        operation: 'updateElementProps',
        elementId: 'element_root',
        props: { padding: 30 },
      },
      {
        afterStage: async (stage) => {
          if (stage === 'prepared') await blocked;
        },
      },
    );
    const secondCommit = await commitSchema(secondPage, {
      changeSetId: 'change_parallel',
      pageId: secondPage.pageId,
      baseRevisionId: secondBase,
      source: { kind: 'user' },
      createdAt: '2026-08-28T00:00:00.000Z',
      operation: 'updateElementProps',
      elementId: 'element_root',
      props: { padding: 31 },
    });
    expect(secondCommit.schema.elements.element_root.props.padding).toBe(31);
    release();
    await firstCommit;
  });

  it('orders a concurrent commit and undo and releases the queue after failure', async () => {
    const page = await createPageFixture();
    const baseRevisionId = await initializePageSchema(page, schema);
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const committed = commitSchema(
      page,
      {
        changeSetId: 'change_before_undo',
        pageId: page.pageId,
        baseRevisionId,
        source: { kind: 'agent', runId: 'run_test' },
        createdAt: '2026-08-28T00:00:00.000Z',
        operation: 'updateElementProps',
        elementId: 'element_root',
        props: { padding: 40 },
      },
      {
        afterStage: async (stage) => {
          if (stage === 'prepared') await blocked;
        },
      },
    );
    const undone = undoSchema(page);
    release();
    await committed;
    expect((await undone).schema.elements.element_root.props.padding).toBe(8);

    await expect(
      commitSchema(page, {
        changeSetId: 'change_invalid_target',
        pageId: page.pageId,
        baseRevisionId: (await getSchema(page)).revisionId,
        source: { kind: 'user' },
        createdAt: '2026-08-28T00:00:00.000Z',
        operation: 'updateElementProps',
        elementId: 'element_missing',
        props: {},
      }),
    ).rejects.toThrow('目标元素不存在');
    expect((await getSchema(page)).schema.elements.element_root.props.padding).toBe(8);
  });
});
