import { equalJson, type MaterialManifest } from '@origamix/shared';
import type { Material, PanelConfig } from '../interfaces/material-interfaces';
import type {
  EditorPlugin,
  EditorPluginMaterialNodeContext,
} from '../interfaces/plugin-interfaces';
import { editorSnapshot } from '../session/editor-snapshots';

/** UI additions may only address fields already accepted by the installed Manifest. */
const validatePanels = (panels: readonly PanelConfig[], manifest: MaterialManifest): void => {
  const ids = new Set<string>();
  const properties = manifest.propsSchema.properties ?? {};
  for (const panel of panels) {
    if (panel.id && ids.has(panel.id))
      throw new Error(`物料 ${manifest.type} 的面板 ID 重复：${panel.id}`);
    if (panel.id) ids.add(panel.id);
    for (const config of panel.configs ?? [])
      if (!Object.hasOwn(properties, config.field))
        throw new Error(`物料 ${manifest.type} 的属性 ${config.field} 未在 Manifest 中声明`);
  }
};

export const extendEditorMaterial = (
  material: Material,
  manifest: MaterialManifest,
  plugins: readonly EditorPlugin[],
): Material => {
  const result = plugins.reduceRight<Material>((current, plugin) => {
    const extension = plugin.material?.extend?.({
      material: editorSnapshot(current) as Material,
      manifest: editorSnapshot(manifest),
    });
    if (!extension) return current;
    const properties = manifest.propsSchema.properties ?? {};
    for (const [field, value] of Object.entries(extension.defaultProps ?? {})) {
      if (!Object.hasOwn(properties, field))
        throw new Error(`物料 ${material.type} 的属性 ${field} 未在 Manifest 中声明`);
      if (
        !Object.hasOwn(manifest.defaultProps, field) ||
        !equalJson(manifest.defaultProps[field], value)
      )
        throw new Error(`物料 ${material.type} 的默认属性 ${field} 与 Manifest 不一致`);
    }
    const panels = [...(current.editorConfig?.panels ?? []), ...(extension.panels ?? [])];
    validatePanels(panels, manifest);
    return {
      ...current,
      defaultProps: { ...current.defaultProps, ...extension.defaultProps },
      editorConfig: { ...current.editorConfig, panels },
    };
  }, material);
  return result;
};

export const resolveMaterialPanels = (
  context: EditorPluginMaterialNodeContext,
  plugins: readonly EditorPlugin[],
): readonly PanelConfig[] => {
  return plugins.reduceRight<readonly PanelConfig[]>((panels, plugin) => {
    if (!plugin.material?.getPanels) return panels;
    const resolved =
      plugin.material?.getPanels?.({
        ...context,
        manifest: editorSnapshot(context.manifest),
        panels: editorSnapshot(panels) as readonly PanelConfig[],
      }) ?? panels;
    validatePanels(resolved, context.manifest);
    return resolved;
  }, context.material.editorConfig?.panels ?? []);
};
