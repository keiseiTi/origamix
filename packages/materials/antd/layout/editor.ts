import type { EditorPlugin } from '@origamix/editor';
import Layout from './material-config';
import LayoutRegion from '../layout-region/material-config';
import PageOutlet from '../page-outlet/material-config';
import Container from '../container/material-config';
import Text from '../text/material-config';
import Button from '../button/material-config';
import { layoutRegionDefaults, reconcileAntdLayoutSchema } from './schema';
export { antdLayoutManifest as antdMaterialManifest } from './manifest';
export const rootMaterials = [Layout, LayoutRegion, PageOutlet].map((material) => ({
  ...material,
  contextConfig: { ...material.contextConfig, events: [] },
}));
export const rootManifests = rootMaterials.map((material) => material.manifest);
export const materialGroups = [
  {
    title: '区域内容',
    children: [Container, Text, Button].map((material) => ({
      ...material,
      contextConfig: { ...material.contextConfig, events: [] },
    })),
  },
];
export const editorPlugins: readonly EditorPlugin[] = [
  {
    id: 'antd.layout',
    schema: {
      beforeChange: ({ before, candidate }) => reconcileAntdLayoutSchema(candidate, before),
    },
    material: {
      getPanels: ({ material, element, panels }) => {
        if (material.type === 'PageOutlet') return [];
        if (material.type === 'Layout')
          return panels.filter((panel) => panel.title !== '布局' && panel.title !== '属性');
        if (material.type !== 'LayoutRegion') return panels;
        const fields =
          layoutRegionDefaults[element.props.region as keyof typeof layoutRegionDefaults];
        return panels
          .filter((panel) => panel.title === '区域属性')
          .map((panel) => ({
            ...panel,
            configs: panel.configs?.filter(
              (config) => fields && Object.hasOwn(fields, config.field),
            ),
          }))
          .filter((panel) => panel.configs?.length);
      },
    },
  },
];
export const propertyEditors = [] as const;
export const antdBlocks = [] as const;
