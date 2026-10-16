import type { EditorMaterialRegistration } from '@origamix/editor/contracts';
import {
  validateResolvedProjectStack,
  type ProjectStack,
} from '@origamix/shared/protocol/project-stack';

// Literal imports are an allowlist, never module paths supplied by project files.
const builtinLoaders = {
  editor: () => import('@origamix/materials/antd/editor'),
  runtime: () => import('@origamix/materials/antd/runtime'),
};
const editorLoads = new Map<string, Promise<EditorMaterialRegistration>>();
const runtimeLoads = new Map<string, ReturnType<typeof builtinLoaders.runtime>>();

export const loadEditorMaterials = async (
  stack: ProjectStack,
): Promise<EditorMaterialRegistration> => {
  const resolved = validateResolvedProjectStack(stack);
  const key = `${resolved.materialSet.id}@${resolved.materialSet.version}`;
  let pending = editorLoads.get(key);
  if (!pending) {
    pending = builtinLoaders.editor().then((module) => {
      if (
        module.antdMaterialManifest.materialSet.id !== resolved.materialSet.id ||
        module.antdMaterialManifest.materialSet.version !== resolved.materialSet.version
      )
        throw new Error('编辑物料与项目要求的版本不一致');
      return {
        catalog: module.antdMaterialManifest,
        groups: module.materialGroups,
        propertyEditors: module.propertyEditors,
      };
    });
    editorLoads.set(key, pending);
  }
  try {
    return await pending;
  } catch (reason) {
    if (editorLoads.get(key) === pending) editorLoads.delete(key);
    throw reason;
  }
};

export const loadRuntimeMaterials = async (stack: ProjectStack) => {
  const resolved = validateResolvedProjectStack(stack);
  const key = `${resolved.materialSet.id}@${resolved.materialSet.version}`;
  let pending = runtimeLoads.get(key);
  if (!pending) {
    pending = builtinLoaders.runtime();
    runtimeLoads.set(key, pending);
  }
  try {
    const module = await pending;
    if (
      module.materialSet.id !== resolved.materialSet.id ||
      module.materialSet.version !== resolved.materialSet.version
    )
      throw new Error('运行物料与项目要求的版本不一致');
    return module.default;
  } catch (reason) {
    if (runtimeLoads.get(key) === pending) runtimeLoads.delete(key);
    throw reason;
  }
};
