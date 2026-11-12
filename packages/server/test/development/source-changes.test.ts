import { mkdtemp, mkdir, writeFile, utimes, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createSourceChangeFilter } from '../../scripts/source-changes';

// Repeated host restarts interrupt Agent/edit recovery; notifications alone cannot authorize a rebuild.
it('ignores metadata, identical writes and generated outputs while detecting each source change once', async () => {
  const root = await mkdtemp(join(tmpdir(), 'origamix-source-events-'));
  try {
    const directory = join(root, 'packages/materials/antd');
    await mkdir(join(directory, 'generated'), { recursive: true });
    const source = join(directory, 'material-config.ts');
    await writeFile(source, 'export const value = 1;');
    const changed = createSourceChangeFilter(root, { materials: ['packages/materials/antd'] });
    expect(changed('materials')).toBe(false);
    await utimes(source, new Date(), new Date());
    await writeFile(source, 'export const value = 1;');
    await writeFile(join(directory, 'generated/manifests.ts'), 'generated');
    await writeFile(join(directory, '.DS_Store'), 'metadata');
    expect(changed('materials')).toBe(false);
    await writeFile(source, 'export const value = 2;');
    expect(changed('materials')).toBe(true);
    expect(changed('materials')).toBe(false);
    await rm(source);
    expect(changed('materials')).toBe(true);
    expect(changed('materials')).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
