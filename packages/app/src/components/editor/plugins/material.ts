import { definePlugin, type EditorPlugin } from '@tangramino/base-editor';

/**
 * Material 插件 - 为所有 material 添加默认配置
 * 使用不可变的 transformMaterials 模式
 */
export const materialPlugin = definePlugin<EditorPlugin>(() => ({
  id: 'material',

  transformMaterials: (materials) => {
    return materials.map((material) => {
      // 添加 init 方法到 contextConfig
      const existingMethods = material.contextConfig?.methods || [];
      const hasInitMethod = existingMethods.some((method) => method.name === 'init');
      const methods = hasInitMethod
        ? existingMethods
        : [{ name: 'init', description: '初始化' }, ...existingMethods];

      // 添加 alias 字段到属性面板
      const panels = material.editorConfig?.panels?.map((panel) => {
        if (panel.title !== '属性') return panel;

        const hasAliasConfig = panel.configs?.some((config) => config.field === 'alias');
        if (hasAliasConfig) return panel;

        return {
          ...panel,
          configs: [
            { label: '别名', field: 'alias', required: true, uiType: 'input' },
            ...(panel.configs || []),
          ],
        };
      });

      return {
        ...material,
        contextConfig: {
          ...material.contextConfig,
          methods,
        },
        editorConfig: {
          ...material.editorConfig,
          panels,
        },
      };
    });
  },
}));
