import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ignored = new Set(['node_modules', 'dist', '.git', '.cache', '.DS_Store']);

/** File notifications are hints: builds and metadata changes must not restart a host. */
export const createSourceChangeFilter = (root: string, groups: Record<string, string[]>) => {
  const fingerprint = (paths: string[]) => {
    const hash = createHash('sha256');
    const collect = (path: string): void => {
      const name = relative(root, path).replaceAll('\\', '/');
      if (
        name === 'packages/materials/antd/generated' ||
        name.startsWith('packages/materials/antd/generated/')
      )
        return;
      try {
        const info = lstatSync(path);
        if (info.isSymbolicLink()) return;
        if (info.isDirectory()) {
          for (const child of readdirSync(path).sort())
            if (!ignored.has(child)) collect(join(path, child));
        } else if (info.isFile() && !name.endsWith('.tsbuildinfo') && !name.endsWith('.tmp')) {
          hash.update(name);
          hash.update('\0');
          hash.update(readFileSync(path));
          hash.update('\0');
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    };
    for (const path of paths) collect(join(root, path));
    return hash.digest('hex');
  };
  const previous = new Map(
    Object.entries(groups).map(([name, paths]) => [name, fingerprint(paths)]),
  );
  return (name: string): boolean => {
    const paths = groups[name];
    if (!paths) throw new Error(`Unknown development source group: ${name}`);
    const next = fingerprint(paths);
    if (previous.get(name) === next) return false;
    previous.set(name, next);
    return true;
  };
};
