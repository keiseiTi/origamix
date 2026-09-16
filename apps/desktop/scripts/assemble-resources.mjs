import { prepareTemplateArtifact } from '@origamix/server/template-artifact';
import { desktopRoot, workspaceRoot } from './build-options.mjs';

export const assembleResources = async () => {
  // TODO(post-MVP): publish these packages and replace the vendored archives
  // with pinned registry versions in generated projects.
  await prepareTemplateArtifact({
    sourceTemplate: `${workspaceRoot}packages/template`,
    targetTemplate: `${desktopRoot}dist/template`,
    runtimePackage: `${workspaceRoot}packages/runtime`,
    materialsPackage: `${workspaceRoot}packages/materials`,
  });
};
