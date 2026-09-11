import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { copyTemplate } from '@origamix/server/template';

const packages = [
  { dependency: '@origamix/runtime', prefix: 'origamix-runtime-', targetName: 'runtime.tgz' },
  { dependency: '@origamix/materials', prefix: 'origamix-materials-', targetName: 'materials.tgz' },
];

export const prepareTemplateArtifact = async ({
  sourceTemplate,
  targetTemplate,
  runtimePackage,
  materialsPackage,
}) => {
  await rm(targetTemplate, { recursive: true, force: true });
  await copyTemplate(sourceTemplate, targetTemplate);
  const vendor = join(targetTemplate, 'vendor');
  await mkdir(vendor, { recursive: true });
  const packageDirectories = [runtimePackage, materialsPackage];
  for (const [index, definition] of packages.entries()) {
    const packed = spawnSync(
      process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      ['pack', '--pack-destination', vendor],
      { cwd: packageDirectories[index], stdio: 'inherit', timeout: 120000 },
    );
    if (packed.error || packed.status !== 0)
      throw packed.error ?? new Error(`Unable to package ${packageDirectories[index]}`);
    const archive = (await readdir(vendor)).find((name) => name.startsWith(definition.prefix));
    if (!archive) throw new Error(`Packed archive missing for ${definition.dependency}`);
    await rename(join(vendor, archive), join(vendor, definition.targetName));
  }
  const packagePath = join(targetTemplate, 'package.json');
  const manifest = JSON.parse(await readFile(packagePath, 'utf8'));
  for (const definition of packages)
    manifest.dependencies[definition.dependency] = `file:vendor/${definition.targetName}`;
  await writeFile(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
};
