import {
  antdMaterialManifest,
  antdAgentMaterialCatalog,
  antdValidationMaterialRegistry,
} from '@origamix/materials/antd/manifest';
import {
  BUILTIN_PROJECT_STACK,
  validateResolvedProjectStack,
  type ProjectStack,
} from '@origamix/shared';

import { ProjectManifestStore } from './project-manifest-store';
import { invalid } from '../errors';

export const getProjectMaterials = (stack: ProjectStack) => {
  validateResolvedProjectStack(stack);
  if (
    antdMaterialManifest.materialSet.id !== stack.materialSet.id ||
    antdMaterialManifest.materialSet.version !== stack.materialSet.version
  )
    throw invalid('已安装物料清单与项目要求的版本不一致');
  return {
    manifest: antdMaterialManifest,
    agentCatalog: antdAgentMaterialCatalog,
    validation: { materialSet: stack.materialSet, registry: antdValidationMaterialRegistry },
  };
};

export const builtinProjectMaterials = getProjectMaterials(BUILTIN_PROJECT_STACK);

export const loadProjectMaterials = async (projectPath: string) => {
  const stack = await new ProjectManifestStore().readStack(projectPath);
  return getProjectMaterials(stack);
};
