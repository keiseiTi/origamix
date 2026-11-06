import { validateAntdMaterialSemantics } from '@origamix/materials/antd/validation';
import {
  antdMaterialManifest,
  antdBlocks,
  antdAgentMaterialCatalog,
  antdValidationMaterialRegistry,
} from '@origamix/materials/antd/manifest';
import {
  BUILTIN_PROJECT_STACK,
  PAGE_OUTLET_TYPE,
  PAGE_NAVIGATION_TYPE,
  PageOutletPropsSchema,
  PageNavigationPropsSchema,
  type MaterialManifest,
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
  const stack = await new ProjectManifestStore().readStack(projectPath);
  return getProjectMaterials(stack);
};

export const loadLayoutMaterials = async (projectPath: string) => {
  const materials = await loadProjectMaterials(projectPath);
  const systems: MaterialManifest[] = [
    { type: PAGE_OUTLET_TYPE, title: '页面内容区', propsSchema: PageOutletPropsSchema },
    { type: PAGE_NAVIGATION_TYPE, title: '页面导航', propsSchema: PageNavigationPropsSchema },
  ].map((item) => ({
    ...item,
    version: materials.manifest.materialSet.version,
    description: item.title,
    keywords: [],
    role: 'layout',
    defaultProps: {},
    acceptsChildren: false,
    layout: { display: 'block' },
    context: { variables: [], writable: [], actions: [], events: [] },
    usage:
      item.type === PAGE_OUTLET_TYPE
        ? '唯一可达叶节点，运行时承载页面。不可删除唯一内容区或添加子节点。'
        : '根据项目页面目录生成导航，不接受任意 URL。',
    constraints: [],
  }));
  return {
    ...materials,
    manifest: {
      ...materials.manifest,
      materials: [
        ...materials.manifest.materials.map((material) => ({
          ...material,
          context: { variables: [], writable: [], actions: [], events: [] },
        })),
        ...systems,
      ],
    },
    agentCatalog: [...materials.agentCatalog, ...systems],
    validation: {
      ...materials.validation,
      registry: {
        ...materials.validation.registry,
        ...Object.fromEntries(systems.map((item) => [item.type, item])),
      },
    },
  };
};
