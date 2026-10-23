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
          materialSet: { id: 'official-antd', version: '1.0.0' },
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

it('rejects incomplete project manifests without rewriting the file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'origamix-manifest-invalid-'));
  const path = join(directory, 'origamix.project.json');
  const source = JSON.stringify({ name: 'Incomplete project', pages: [] });
  try {
    await writeFile(path, source);
    await expect(new ProjectManifestStore().readManifest(directory)).rejects.toThrow();
    expect(await readFile(path, 'utf8')).toBe(source);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
