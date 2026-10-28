import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveProjectStack } from '@origamix/shared';
import { copyTemplate } from '@origamix/server/template';

export interface TemplateArtifactInput {
  sourceTemplate: string;
  targetTemplate: string;
  runtimePackage: string;
  materialsPackage: string;
}

export const prepareTemplateArtifact = async ({
  sourceTemplate,
  targetTemplate,
  runtimePackage,
  materialsPackage,
}: TemplateArtifactInput) => {
  const stack = resolveProjectStack(
    JSON.parse(await readFile(join(sourceTemplate, 'origamix.project.json'), 'utf8')),
  );
  const runtimeManifest = JSON.parse(await readFile(join(runtimePackage, 'package.json'), 'utf8'));
  const materialManifest = JSON.parse(
    await readFile(join(materialsPackage, 'package.json'), 'utf8'),
  );
  const templateManifest = JSON.parse(await readFile(join(sourceTemplate, 'package.json'), 'utf8'));
  if (
    runtimeManifest.version !== stack.runtime.version ||
    materialManifest.version !== stack.materialSet.version ||
    templateManifest.version !== stack.template.version
  )
    throw new Error('Template artifact versions do not match the supported project stack');
  await rm(targetTemplate, { recursive: true, force: true });
  await copyTemplate(sourceTemplate, targetTemplate);
  const packagePath = join(targetTemplate, 'package.json');
  const manifest = JSON.parse(await readFile(packagePath, 'utf8'));
  manifest.dependencies['@origamix/runtime'] = stack.runtime.version;
  manifest.dependencies['@origamix/materials'] = stack.materialSet.version;
  await writeFile(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
};
