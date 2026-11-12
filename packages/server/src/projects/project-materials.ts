import { validateAntdMaterialSemantics } from '@origamix/materials/antd/validation';
import {
  antdMaterialManifest,
  antdBlocks,
  antdAgentMaterialCatalog,
  antdValidationMaterialRegistry,
} from '@origamix/materials/antd/manifest';
import {
  BUILTIN_PROJECT_STACK,
  validateResolvedProjectStack,
  type ProjectStack,
  resolveProjectStack,
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
    blocks: antdBlocks,
    agentCatalog: antdAgentMaterialCatalog,
    validation: {
      materialSet: stack.materialSet,
      registry: antdValidationMaterialRegistry,
      validateSemantics: validateAntdMaterialSemantics,
    },
  };
};

export const builtinProjectMaterials = getProjectMaterials(BUILTIN_PROJECT_STACK);

export const loadProjectMaterials = async (projectPath: string) => {
  const store = new ProjectManifestStore();
  const manifest = await store.readManifest(projectPath);
  const materials = getProjectMaterials(resolveProjectStack(manifest));
  const navigation =
    manifest.runtime === 'origamix'
      ? { pages: manifest.pages.map(({ pageId, name }) => ({ pageId, name })) }
      : undefined;
  return { ...materials, navigation, validation: { ...materials.validation, navigation } };
};
