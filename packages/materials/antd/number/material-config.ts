import { lazy } from 'react';
import { fromMaterialManifest, toEditorMaterial } from '../../src/origamix-material';
import { numberManifest } from './manifest';

const NumberMaterial = toEditorMaterial(
  fromMaterialManifest(numberManifest, {
    editorConfig: {
      panels: [
        {
          title: '属性',
          configs: [
            {
              label: '默认值',
              field: 'defaultValue',
              uiType: 'number',
              props: {},
            },
            {
              label: '最小值',
              field: 'min',
              uiType: 'number',
              props: {
                step: 1,
              },
            },
            {
              label: '最大值',
              field: 'max',
              uiType: 'number',
              props: {
                step: 1,
              },
            },
            {
              label: '精度',
              field: 'precision',
              uiType: 'number',
              props: {
                min: 0,
                max: 10,
                step: 1,
              },
            },
            {
              label: '前缀',
              field: 'prefix',
              uiType: 'input',
              props: {},
            },
            {
              label: '后缀',
              field: 'suffix',
              uiType: 'input',
              props: {},
            },
            {
              label: '前置标签',
              field: 'addonBefore',
              uiType: 'input',
              props: {},
            },
            {
              label: '后置标签',
              field: 'addonAfter',
              uiType: 'input',
              props: {},
            },
            {
              label: '占位符',
              field: 'placeholder',
              uiType: 'input',
              props: {
                placeholder: '请输入占位符文本',
              },
            },
            {
              label: '允许清除',
              field: 'allowClear',
              uiType: 'checkbox',
            },
          ],
        },
      ],
    },
  }),
  lazy(() => import('./index')),
);

export default NumberMaterial;
