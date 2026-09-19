import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { ProjectManifestStore } from '../../projects/project-manifest-store';

it('retains manifest uniqueness checks after structural validation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'origamix-manifest-'));
  const first = { pageId: 'page_home', name: 'Home', slug: 'home' };
  try {
    for (const second of [
      { ...first, slug: 'other' },
      { ...first, pageId: 'page_other' },
    ]) {
      await writeFile(
        join(directory, 'origamix.project.json'),
        JSON.stringify({
          projectId: 'project_test',
          name: 'Test',
          framework: 'react',
          uiLibrary: 'antd',
          pageDirectory: 'pages',
          pages: [first, second],
        }),
      );
      await expect(new ProjectManifestStore().readManifest(directory)).rejects.toThrow('重复');
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('fills only missing manifest fields from the open-project defaults', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'origamix-manifest-defaults-'));
  try {
    await writeFile(
      join(directory, 'origamix.project.json'),
      JSON.stringify({ name: '已有名称', pages: [] }),
    );
    const store = new ProjectManifestStore();
    await store.completeMissingManifestFields(directory, {
      name: '表单名称',
      code: 'opened-project',
      pageDirectory: 'screens',
    });
    expect(
      JSON.parse(await readFile(join(directory, 'origamix.project.json'), 'utf8')),
    ).toMatchObject({
      projectId: expect.stringMatching(/^project_/),
      name: '已有名称',
      code: 'opened-project',
      framework: 'react',
      uiLibrary: 'antd',
      pageDirectory: 'screens',
      pages: [],
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
