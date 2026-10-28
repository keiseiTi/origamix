import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const workspaceRoot = fileURLToPath(new URL('../', import.meta.url));
export const publicPackageNames = ['shared', 'runtime', 'materials'];
export const publicPackage = async (name: string) => {
  if (!publicPackageNames.includes(name)) throw new Error(`Unknown public package: ${name}`);
  const source = join(workspaceRoot, 'packages', name);
  const manifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
  const destination = resolve(workspaceRoot, process.env.ORIGAMIX_PACK_DIR ?? 'release/npm');
  return {
    name,
    source,
    manifest,
    version: manifest.version,
    destination,
    archive: join(destination, `origamix-${name}-${manifest.version}.tgz`),
  };
};
