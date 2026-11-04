import type { EditorPlugin } from '@origamix/editor';
import { formItemPanel } from '../../src/form-item-panel';

/** Manifest fields are composed at definition time; this plugin owns their editor UI. */
export const createAntdFormPlugin = (): EditorPlugin => ({
  id: 'antd.form',
  material: {
    extend: ({ material }) => (material.formField ? { panels: [formItemPanel] } : undefined),
    getPanels: ({ material, ancestors, panels }) => {
      if (!material.formField || ancestors.some((ancestor) => ancestor.material.type === 'form'))
        return panels;
      return panels.filter((panel) => panel.id !== formItemPanel.id);
    },
  },
});
