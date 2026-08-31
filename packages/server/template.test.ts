import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { copyTemplate } from './template';

it('copies only portable source files and excludes workspace dependencies and symlinks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'origamix-template-'));
  const source = join(root, 'source');
  const target = join(root, 'copy');
  try {
    await mkdir(join(source, 'src'), { recursive: true });
    for (const name of ['node_modules', 'dist', '.git']) {
      await mkdir(join(source, name));
      await writeFile(join(source, name, 'sentinel'), 'must not copy');
    }
    await writeFile(join(source, 'package.json'), '{}');
    await writeFile(join(source, 'src', 'main.tsx'), 'export {};');
    await writeFile(join(source, '.env'), 'PRIVATE=not-for-export');
    await writeFile(join(root, 'outside'), 'outside');
    await symlink(join(root, 'outside'), join(source, 'src', 'linked.ts'));
    await copyTemplate(source, target);
    expect((await readdir(target)).sort()).toEqual(['package.json', 'src']);
    expect(await readdir(join(target, 'src'))).toEqual(['main.tsx']);
    expect(await readFile(join(target, 'src', 'main.tsx'), 'utf8')).toBe('export {};');
  } finally { await rm(root, { recursive: true, force: true }); }
});
