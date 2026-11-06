import { LayoutOutlet, LayoutNavigation } from './layout-system-components';
import { layoutPanel } from '@origamix/materials';
import type { EditorMaterialRegistration } from '@origamix/editor';
import {
  PAGE_OUTLET_TYPE,
  PAGE_NAVIGATION_TYPE,
  PageOutletPropsSchema,
  PageNavigationPropsSchema,
  type MaterialManifest,
} from '@origamix/shared';

type Material = EditorMaterialRegistration['groups'][number]['children'][number];
const directionConfig = {
  field: 'direction',
  label: '方向',
  uiType: 'select',
  defaultValue: 'vertical',
  props: {
    options: [
      { label: '横向', value: 'horizontal' },
      { label: '纵向', value: 'vertical' },
    ],
  },
};
const systems: Material[] = [
  {
    type: PAGE_OUTLET_TYPE,
    title: '页面内容区',
    Component: LayoutOutlet,
    acceptsChildren: false,
    layout: { display: 'block' },
    editorConfig: { panels: [layoutPanel] },
  },
  {
    type: PAGE_NAVIGATION_TYPE,
    title: '页面导航',
    Component: LayoutNavigation,
    acceptsChildren: false,
    layout: { display: 'block' },
    defaultProps: { direction: 'vertical' },
    editorConfig: { panels: [{ title: '导航', configs: [directionConfig] }, layoutPanel] },
  },
];
export const withLayoutMaterials = (
  registration: EditorMaterialRegistration,
): EditorMaterialRegistration => ({
  ...registration,
  blocks: registration.blocks?.filter((block) => !Object.keys(block.schema.flows).length),
  groups: [
    { title: '项目布局', children: systems },
    ...registration.groups.map((group) => ({
      ...group,
      children: group.children.map((material) => ({
        ...material,
        contextConfig: { ...material.contextConfig, events: [] },
      })),
    })),
  ],
  catalog: {
    ...registration.catalog,
    materials: [
      ...registration.catalog.materials,
      ...systems.map((material): MaterialManifest => ({
        type: material.type,
        title: material.title,
        version: registration.catalog.materialSet.version,
        description: material.title,
        keywords: [],
        role: 'layout',
        propsSchema:
          material.type === PAGE_OUTLET_TYPE ? PageOutletPropsSchema : PageNavigationPropsSchema,
        defaultProps: material.defaultProps ?? {},
        acceptsChildren: false,
        layout: { display: 'block' },
        context: { variables: [], writable: [], actions: [], events: [] },
        usage: material.title,
        constraints: [],
      })),
    ],
  },
});
