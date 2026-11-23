import { fileURLToPath } from 'node:url';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { prepareTemplateArtifact } from '@origamix/server/template-artifact';
import { desktopRoot, workspaceRoot } from './build-options.ts';

export const assembleResources = async ({ templatePath = `${desktopRoot}dist/template` } = {}) => {
  await mkdir(`${desktopRoot}dist`, { recursive: true });
  const targetEnv = `${desktopRoot}dist/.env`;
  try {
    await copyFile(`${desktopRoot}.env`, targetEnv);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    await writeFile(targetEnv, '');
  }
  await prepareTemplateArtifact({
    sourceTemplate: `${workspaceRoot}packages/template`,
    targetTemplate: templatePath,
    runtimePackage: `${workspaceRoot}packages/runtime`,
    materialsPackage: `${workspaceRoot}packages/materials`,
  });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await assembleResources({ templatePath: process.argv[2] });
}
