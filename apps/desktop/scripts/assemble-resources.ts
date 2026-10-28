import { fileURLToPath } from 'node:url';
import { copyFile, mkdir } from 'node:fs/promises';
import { prepareTemplateArtifact } from '@origamix/server/template-artifact';
import { desktopRoot, workspaceRoot } from './build-options.ts';

export const assembleResources = async ({ templatePath = `${desktopRoot}dist/template` } = {}) => {
  await mkdir(`${desktopRoot}dist`, { recursive: true });
  await copyFile(`${desktopRoot}.env`, `${desktopRoot}dist/.env`);
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
