import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync, type Zippable } from 'fflate';

const archiveTime = new Date(2000, 0, 1, 12);

const collectFiles = async (directory: string): Promise<Zippable> => {
  const files: Zippable = Object.create(null);
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files[entry.name] = await collectFiles(path);
    else if (entry.isFile()) files[entry.name] = await readFile(path);
  }
  return files;
};

export const prepareWebTemplate = async (targetTemplate: string) => {
  const { prepareTemplateArtifact } = await import('@origamix/server/template-artifact');
  await prepareTemplateArtifact({
    sourceTemplate: fileURLToPath(new URL('../template', import.meta.url)),
    targetTemplate,
    runtimePackage: fileURLToPath(new URL('../runtime', import.meta.url)),
    materialsPackage: fileURLToPath(new URL('../materials', import.meta.url)),
  });
  const { version } = JSON.parse(await readFile(join(targetTemplate, 'package.json'), 'utf8'));
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][\w.+-]+)?$/.test(version))
    throw new Error('模板版本无效');
  const body = Buffer.from(zipSync(await collectFiles(targetTemplate), { mtime: archiveTime }));
  return { version, body, sha256: createHash('sha256').update(body).digest('hex') };
};
