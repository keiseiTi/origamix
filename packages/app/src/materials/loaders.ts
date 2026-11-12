import type { EditorMaterialRegistration } from '@origamix/editor';
import type { ProjectStack } from '@origamix/shared';

// Literal imports are an allowlist, never module paths supplied by project files.
const builtinLoaders = {
  editor: () => import('@origamix/materials/antd/editor'),
  runtime: () => import('@origamix/materials/antd/runtime'),
};
const editorLoads = new Map<string, Promise<EditorMaterialRegistration>>();
const runtimeLoads = new Map<string, ReturnType<typeof builtinLoaders.runtime>>();

export const loadEditorMaterials = async (
  materialSet: ProjectStack['materialSet'],
  kind: 'page' = 'page',
): Promise<EditorMaterialRegistration> => {
  const key = `${materialSet.id}@${materialSet.version}:${kind}`;
  let pending = editorLoads.get(key);
  if (!pending) {
    pending = builtinLoaders.editor().then((module) => {
      if (
        module.antdMaterialManifest.materialSet.id !== materialSet.id ||
        module.antdMaterialManifest.materialSet.version !== materialSet.version
      )
        throw new Error('编辑物料与项目要求的版本不一致');
      return {
        catalog: {
          ...module.antdMaterialManifest,
          materials: [
            ...module.antdMaterialManifest.materials,
            ...module.rootManifests.filter(
              (root) =>
                !module.antdMaterialManifest.materials.some(
                  (material) => material.type === root.type,
                ),
            ),
          ],
        },
        rootMaterials: module.rootMaterials,
        groups: module.materialGroups,
        propertyEditors: module.propertyEditors,
        plugins: module.editorPlugins,
        blocks: module.antdBlocks,
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

export const loadRuntimeMaterials = async (materialSet: ProjectStack['materialSet']) => {
  const key = `${materialSet.id}@${materialSet.version}`;
  let pending = runtimeLoads.get(key);
  if (!pending) {
    pending = builtinLoaders.runtime();
    runtimeLoads.set(key, pending);
  }
  try {
    const module = await pending;
    if (
      module.materialSet.id !== materialSet.id ||
      module.materialSet.version !== materialSet.version
    )
      throw new Error('运行物料与项目要求的版本不一致');
    return { components: module.default, Provider: module.RuntimeProvider };
  } catch (reason) {
    if (runtimeLoads.get(key) === pending) runtimeLoads.delete(key);
    throw reason;
  }
};
