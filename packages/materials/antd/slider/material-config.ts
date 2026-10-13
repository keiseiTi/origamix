import { lazy } from 'react';
import { fromMaterialManifest, toEditorMaterial } from '../../src/origamix-material';
import { sliderManifest } from './manifest';

const material = toEditorMaterial(
  fromMaterialManifest(sliderManifest, {
    editorConfig: {
      panels: [
        {
          title: '属性',
          configs: [
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
              label: '步长',
              field: 'step',
              uiType: 'number',
              props: {
                min: 0.01,
                step: 0.1,
              },
            },
            {
              label: '范围模式',
              field: 'range',
              uiType: 'checkbox',
              defaultValue: false,
            },
            {
              label: '初始值',
              field: 'defaultValue',
              uiType: 'number',
              linkageShow: [
                {
                  field: 'range',
                  value: false,
                },
              ],
              props: {
                step: 1,
              },
            },
            {
              label: '初始下限',
              field: 'defaultStart',
              uiType: 'number',
              linkageShow: [
                {
                  field: 'range',
                  value: true,
                },
              ],
              props: {
                step: 1,
              },
            },
            {
              label: '初始上限',
              field: 'defaultEnd',
              uiType: 'number',
              linkageShow: [
                {
                  field: 'range',
                  value: true,
                },
              ],
              props: {
                step: 1,
              },
            },
            {
              label: '禁用',
              field: 'disabled',
              uiType: 'checkbox',
              defaultValue: false,
            },
            {
              label: '键盘调整',
              field: 'keyboard',
              uiType: 'checkbox',
              defaultValue: true,
            },
            {
              label: '反向',
              field: 'reverse',
              uiType: 'checkbox',
              defaultValue: false,
            },
            {
              label: '垂直',
              field: 'vertical',
              uiType: 'checkbox',
              defaultValue: false,
            },
            {
              label: '显示刻度点',
              field: 'dots',
              uiType: 'checkbox',
              defaultValue: false,
            },
            {
              label: '显示选中区间',
              field: 'included',
              uiType: 'checkbox',
              defaultValue: true,
            },
            {
              label: '范围可拖动',
              field: 'draggableTrack',
              uiType: 'checkbox',
              defaultValue: false,
              linkageShow: [
                {
                  field: 'range',
                  value: true,
                },
              ],
            },
            {
              label: '提示显示',
              field: 'tooltipMode',
              uiType: 'select',
              props: {
                options: [
                  {
                    label: '默认',
                    value: 'auto',
                  },
                  {
                    label: '始终显示',
                    value: 'always',
                  },
                  {
                    label: '隐藏',
                    value: 'hidden',
                  },
                ],
              },
            },
            {
              label: '提示位置',
              field: 'tooltipPlacement',
              uiType: 'select',
              props: {
                options: [
                  {
                    label: '上方',
                    value: 'top',
                  },
                  {
                    label: '下方',
                    value: 'bottom',
                  },
                  {
                    label: '左侧',
                    value: 'left',
                  },
                  {
                    label: '右侧',
                    value: 'right',
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  }),
  lazy(() => import('./index')),
);
export default material;
