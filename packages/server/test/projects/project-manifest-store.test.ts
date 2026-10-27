import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { ProjectManifestStore } from '../../src/projects/project-manifest-store';

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
          version: '1.0.0',
          materialSet: 'official-antd',
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

it('rejects missing project versions without inferring or rewriting them', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'origamix-manifest-invalid-'));
  const path = join(directory, 'origamix.project.json');
  const store = new ProjectManifestStore();
  try {
    await store.initializeManifest(directory, {
      projectId: 'project_test',
      name: 'Current project',
      pageDirectory: 'pages',
      code: 'current-project',
    });
    const manifest = await store.readManifest(directory);
    const source = JSON.stringify({ ...manifest, version: undefined });
    await writeFile(path, source);
    await expect(new ProjectManifestStore().readManifest(directory)).rejects.toThrow();
    expect(await readFile(path, 'utf8')).toBe(source);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
