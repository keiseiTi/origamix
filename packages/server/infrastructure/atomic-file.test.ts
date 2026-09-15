import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { writeFileAtomically, writeJsonAtomically } from './atomic-file';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return { ...actual, open: vi.fn(actual.open), rename: vi.fn(actual.rename) };
});

const directories: string[] = [];
afterEach(async () => {
  vi.mocked(fs.open).mockReset();
  vi.mocked(fs.rename).mockReset();
  const actual = await vi.importActual<typeof fs>('node:fs/promises');
  vi.mocked(fs.open).mockImplementation(actual.open);
  vi.mocked(fs.rename).mockImplementation(actual.rename);
  await Promise.all(
    directories.splice(0).map((path) => fs.rm(path, { recursive: true, force: true })),
  );
});

it.each(['writeFile', 'sync', 'rename'] as const)(
  'preserves the previous file, cleans temporary files and allows retry after %s fails',
  async (stage) => {
    const directory = await fs.mkdtemp(join(tmpdir(), 'origamix-atomic-'));
    directories.push(directory);
    const path = join(directory, 'working.json');
    await fs.writeFile(path, 'previous');
    const error = new Error('disk failure');
    if (stage === 'rename') {
      vi.mocked(fs.rename).mockRejectedValueOnce(error);
    } else {
      const actual = await vi.importActual<typeof fs>('node:fs/promises');
      vi.mocked(fs.open).mockImplementationOnce(async (...args) => {
        const handle = await actual.open(...args);
        vi.spyOn(handle, stage).mockRejectedValueOnce(error);
        return handle;
      });
    }
    await expect(writeFileAtomically(path, 'replacement')).rejects.toThrow('disk failure');
    expect(await fs.readFile(path, 'utf8')).toBe('previous');
    expect(await fs.readdir(directory)).toEqual(['working.json']);
    await writeJsonAtomically(path, { saved: true });
    expect(JSON.parse(await fs.readFile(path, 'utf8'))).toEqual({ saved: true });
    expect((await fs.stat(path)).mode & 0o777).toBe(0o600);
    expect(await fs.readdir(directory)).toEqual(['working.json']);
  },
);
