import { lazy } from 'react';
import { fromMaterialManifest, toEditorMaterial } from '../../src/origamix-material';
import { switchManifest } from './manifest';

const material = toEditorMaterial(
  fromMaterialManifest(switchManifest, {
    editorConfig: {
      panels: [
        {
          title: '属性',
          configs: [
            {
              label: '初始开启',
              field: 'defaultChecked',
              uiType: 'checkbox',
            },
            {
              label: '禁用',
              field: 'disabled',
              uiType: 'checkbox',
            },
            {
              label: '加载中',
              field: 'loading',
              uiType: 'checkbox',
            },
            {
              label: '尺寸',
              field: 'size',
              uiType: 'select',
              props: {
                options: [
                  {
                    label: '默认',
                    value: 'default',
                  },
                  {
                    label: '小',
                    value: 'small',
                  },
                ],
              },
            },
            {
              label: '开启文案',
              field: 'checkedChildren',
              uiType: 'input',
            },
            {
              label: '关闭文案',
              field: 'unCheckedChildren',
              uiType: 'input',
            },
          ],
        },
      ],
    },
  }),
  lazy(() => import('./index')),
);

export default material;
