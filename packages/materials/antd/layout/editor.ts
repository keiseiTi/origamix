import type { EditorPlugin } from '@origamix/editor';
import Layout from './material-config';
import LayoutRegion from '../layout-region/material-config';
import PageOutlet from '../page-outlet/material-config';
import Container from '../container/material-config';
import Text from '../text/material-config';
import Button from '../button/material-config';
import { reconcileAntdLayoutSchema } from './schema';
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
      getPanels: ({ material, panels }) =>
        material.type === 'LayoutRegion' || material.type === 'PageOutlet' ? [] : panels,
    },
  },
];
export const propertyEditors = [] as const;
export const antdBlocks = [] as const;
