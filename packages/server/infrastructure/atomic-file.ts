import { open, rename, rm } from 'node:fs/promises';
import { nanoid } from 'nanoid';

/** The caller owns path authorization and parent-directory creation. */
export const writeFileAtomically = async (path: string, contents: string): Promise<void> => {
  const temporary = `${path}.${nanoid()}.tmp`;
  const handle = await open(temporary, 'wx', 0o600);
  try {
    try {
      await handle.writeFile(contents, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
};

export const writeJsonAtomically = (path: string, value: unknown): Promise<void> =>
  writeFileAtomically(path, `${JSON.stringify(value, null, 2)}\n`);
