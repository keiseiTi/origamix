import { lazy } from 'react';
import { fromMaterialManifest, toEditorMaterial } from '../../src/origamix-material';
import { drawerManifest } from './manifest';

const DrawerMaterial = toEditorMaterial(
  fromMaterialManifest(drawerManifest, {
    editorConfig: {
      panels: [
        {
          title: '属性',
          configs: [
            {
              label: '标题',
              field: 'title',
              uiType: 'input',
            },
            {
              label: '宽度',
              field: 'width',
              uiType: 'number',
              props: {
                min: 200,
                max: 1200,
                step: 10,
                unit: 'px',
              },
            },
            {
              label: '位置',
              field: 'placement',
              uiType: 'radio',
              props: {
                options: [
                  { label: '左侧', value: 'left' },
                  { label: '右侧', value: 'right' },
                  { label: '顶部', value: 'top' },
                  { label: '底部', value: 'bottom' },
                ],
              },
            },
            {
              label: '可关闭',
              field: 'closable',
              uiType: 'checkbox',
            },
            {
              label: '遮罩可关闭',
              field: 'maskClosable',
              uiType: 'checkbox',
            },
            {
              label: '强制渲染',
              field: 'forceRender',
              uiType: 'checkbox',
            },
          ],
        },
      ],
    },
    isContainer: true,
  }),
  lazy(() => import('./index')),
);

export default DrawerMaterial;
