import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import { commitSchema, getSchema, initializePageSchema, undoSchema } from './schema-service';

const directories: string[] = [];

const schema: OrigamixPageSchema = {
  elements: { element_root: { type: 'container', props: { title: '原始标题' } } },
  layout: { root: 'element_root', structure: { element_root: [] } },
  flows: {},
  bindElements: [],
  context: { globalVariables: [] },
  extensions: { origamix: { schemaVersion: '1.0' } },
};

async function createPageFixture(): Promise<{
  projectPath: string;
  pageId: string;
  slug: string;
}> {
  const projectPath = await mkdtemp(join(tmpdir(), 'origamix-schema-'));
  directories.push(projectPath);
  const pageId = 'page_test';
  const slug = 'test-page';
  const pagePath = join(projectPath, 'src', 'pages', slug);
  await mkdir(pagePath, { recursive: true });
  await writeFile(
    join(pagePath, 'page.meta.json'),
    JSON.stringify({ pageId, name: '测试页面', slug }),
  );
  await writeFile(join(pagePath, 'schema.json'), JSON.stringify(schema));
  return { projectPath, pageId, slug };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('Schema Service', () => {
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
      props: { title: '更新后的标题' },
    });

    expect(result.revisionId).not.toBe(initialRevisionId);
    expect(result.schema.elements.element_root.props.title).toBe('更新后的标题');
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
      props: { title: '更新后的标题' },
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
        props: { title: '不应保存' },
      }),
    ).rejects.toThrow('页面已更新');

    const undone = await undoSchema(page);
    expect(undone.schema.elements.element_root.props.title).toBe('原始标题');
    expect((await getSchema(page)).revisionId).toBe(undone.revisionId);
    expect(updated.revisionId).not.toBe(undone.revisionId);
  });
});
