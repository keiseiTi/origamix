import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import {
  applyWorkingSchemaOperations,
  getSchema,
  getWorkingSchemaState,
  initializePageSchema,
  listRevisionHistory,
  restoreRevisionToWorking,
  saveWorkingRevision,
  updateWorkingSchema,
} from '../../schema/schema-service';

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
  it('updates the Working draft without creating a Revision', async () => {
    const page = await createPageFixture();
    const initialRevisionId = await initializePageSchema(page, schema);
    const initial = await getWorkingSchemaState(page);
    const updated = await updateWorkingSchema(page, {
      baseWorkingVersion: initial.workingVersion,
      schema: {
        ...schema,
        elements: {
          ...schema.elements,
          element_root: { type: 'container', props: { padding: 24 } },
        },
      },
    });

    expect(updated.workingVersion).toBe(initial.workingVersion + 1);
    expect(updated.revisionId).toBe(initialRevisionId);
    expect(updated.workingHash).not.toBe(updated.savedSchemaHash);
    expect((await getSchema(page)).schema.elements.element_root.props.padding).toBe(24);
    expect(
      await readdir(join(page.projectPath, '.origamix', 'revisions', page.pageId)),
    ).toHaveLength(1);
  });

  it('saves the current Working draft as one idempotent Revision checkpoint', async () => {
    const page = await createPageFixture();
    await initializePageSchema(page, schema);
    const initial = await getWorkingSchemaState(page);
    const draft = await applyWorkingSchemaOperations(page, {
      baseWorkingVersion: initial.workingVersion,
      operations: [
        {
          operation: 'updateElementProps',
          elementId: 'element_root',
          set: { padding: 32 },
        },
      ],
    });
    const saved = await saveWorkingRevision(page, draft.workingVersion);

    expect(saved.revisionId).not.toBe(initial.revisionId);
    expect(saved.workingHash).toBe(saved.savedSchemaHash);
    expect(saved.workingVersion).toBe(draft.workingVersion + 1);
    const repeated = await saveWorkingRevision(page, saved.workingVersion);
    expect(repeated).toEqual(saved);
    expect(
      await readdir(join(page.projectPath, '.origamix', 'revisions', page.pageId)),
    ).toHaveLength(2);
  });

  it('lists immutable Revisions newest first with current and applied markers', async () => {
    const page = await createPageFixture();
    const initialRevisionId = await initializePageSchema(page, schema);
    const initial = await getWorkingSchemaState(page);
    const draft = await applyWorkingSchemaOperations(page, {
      baseWorkingVersion: initial.workingVersion,
      operations: [
        {
          operation: 'updateElementProps',
          elementId: 'element_root',
          set: { padding: 40 },
        },
      ],
    });
    const saved = await saveWorkingRevision(page, draft.workingVersion);

    const history = await listRevisionHistory(page);

    expect(history.revisions).toHaveLength(2);
    expect(history.revisions[0]).toMatchObject({
      revisionId: saved.revisionId,
      isCurrent: true,
      isApplied: false,
      source: { kind: 'user' },
    });
    expect(history.revisions[1]).toMatchObject({
      revisionId: initialRevisionId,
      isCurrent: false,
      isApplied: true,
    });
  });

  it.each([
    ['prepared', false],
    ['revision', true],
    ['schema', true],
  ] as const)(
    'recovers a save-version interruption after %s without losing the Working draft',
    async (failedStage, savedAfterRecovery) => {
      const page = await createPageFixture();
      const initialRevisionId = await initializePageSchema(page, schema);
      const initial = await getWorkingSchemaState(page);
      const draft = await applyWorkingSchemaOperations(page, {
        baseWorkingVersion: initial.workingVersion,
        operations: [
          {
            operation: 'updateElementProps',
            elementId: 'element_root',
            set: { padding: 36 },
          },
        ],
      });
      await expect(
        saveWorkingRevision(page, draft.workingVersion, {
          afterStage(stage) {
            if (stage === failedStage) throw new Error(`interrupt:${stage}`);
          },
        }),
      ).rejects.toThrow(`interrupt:${failedStage}`);

      const recovered = await getWorkingSchemaState(page);
      expect(recovered.schema.elements.element_root.props.padding).toBe(36);
      expect(recovered.workingHash === recovered.savedSchemaHash).toBe(savedAfterRecovery);
      expect(recovered.revisionId === initialRevisionId).toBe(!savedAfterRecovery);
      expect(recovered.workingVersion).toBe(
        savedAfterRecovery ? draft.workingVersion + 1 : draft.workingVersion,
      );
    },
  );

  it('restores a historical Revision into Working without saving a new Revision', async () => {
    const page = await createPageFixture();
    const initialRevisionId = await initializePageSchema(page, schema);
    const initial = await getWorkingSchemaState(page);
    const draft = await updateWorkingSchema(page, {
      baseWorkingVersion: initial.workingVersion,
      schema: {
        ...schema,
        elements: {
          ...schema.elements,
          element_root: { type: 'container', props: { padding: 40 } },
        },
      },
    });
    const saved = await saveWorkingRevision(page, draft.workingVersion);
    const restored = await restoreRevisionToWorking(page, initialRevisionId, saved.workingVersion);

    expect(restored.schema.elements.element_root.props.padding).toBe(8);
    expect(restored.revisionId).toBe(saved.revisionId);
    expect(restored.workingHash).not.toBe(restored.savedSchemaHash);
    expect(
      await readdir(join(page.projectPath, '.origamix', 'revisions', page.pageId)),
    ).toHaveLength(2);
  });

  it('rejects a stale Working version without changing the draft', async () => {
    const page = await createPageFixture();
    await initializePageSchema(page, schema);
    const initial = await getWorkingSchemaState(page);
    const first = await applyWorkingSchemaOperations(page, {
      baseWorkingVersion: initial.workingVersion,
      operations: [
        {
          operation: 'updateElementProps',
          elementId: 'element_root',
          set: { padding: 12 },
        },
      ],
    });
    await expect(
      applyWorkingSchemaOperations(page, {
        baseWorkingVersion: initial.workingVersion,
        operations: [
          {
            operation: 'updateElementProps',
            elementId: 'element_root',
            set: { padding: 13 },
          },
        ],
      }),
    ).rejects.toThrow('页面草稿已更新');
    expect((await getWorkingSchemaState(page)).workingHash).toBe(first.workingHash);
  });

  it('rejects a non-current Working file instead of migrating it', async () => {
    const page = await createPageFixture();
    const revisionId = await initializePageSchema(page, schema);
    const workingPath = join(page.projectPath, '.origamix', 'pages', page.pageId, 'working.json');
    const current = JSON.parse(await readFile(workingPath, 'utf8')) as { baselineHash: string };
    await writeFile(
      workingPath,
      JSON.stringify({
        version: 1,
        pageId: page.pageId,
        revisionId,
        baselineHash: current.baselineHash,
        schema,
      }),
    );

    await expect(getWorkingSchemaState(page)).rejects.toThrow('页面工作副本版本无效');
    const persisted = JSON.parse(await readFile(workingPath, 'utf8')) as Record<string, unknown>;
    expect(persisted).toMatchObject({ version: 1, revisionId });
  });

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

  it('applies Working operations and keeps revisions explicit', async () => {
    const page = await createPageFixture();
    const initialRevisionId = await initializePageSchema(page, schema);
    const working = await getWorkingSchemaState(page);
    const draft = await applyWorkingSchemaOperations(page, {
      baseWorkingVersion: working.workingVersion,
      operations: [
        { operation: 'updateElementProps', elementId: 'element_root', set: { padding: 16 } },
      ],
    });
    expect(draft.revisionId).toBe(initialRevisionId);
    expect(draft.schema.elements.element_root.props.padding).toBe(16);
    const saved = await saveWorkingRevision(page, draft.workingVersion);
    expect(saved.revisionId).not.toBe(initialRevisionId);
  });
});
