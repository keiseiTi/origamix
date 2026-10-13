import { lazy } from 'react';
import { fromMaterialManifest, toEditorMaterial } from '../../src/origamix-material';
import { timePickerManifest } from './manifest';

const material = toEditorMaterial(
  fromMaterialManifest(timePickerManifest, {
    editorConfig: {
      panels: [
        {
          title: '属性',
          configs: [
            {
              label: '显示格式',
              field: 'format',
              uiType: 'select',
              props: {
                options: [
                  {
                    label: '时分秒',
                    value: 'HH:mm:ss',
                  },
                  {
                    label: '时分',
                    value: 'HH:mm',
                  },
                  {
                    label: '12 小时制',
                    value: 'hh:mm:ss A',
                  },
                ],
              },
            },
            {
              label: '占位符',
              field: 'placeholder',
              uiType: 'input',
            },
            {
              label: '初始时间（HH:mm:ss）',
              field: 'defaultValue',
              uiType: 'input',
            },
            {
              label: '12 小时制',
              field: 'use12Hours',
              uiType: 'checkbox',
              defaultValue: false,
            },
            {
              label: '小时间隔',
              field: 'hourStep',
              uiType: 'number',
              props: {
                min: 1,
                max: 23,
                step: 1,
              },
            },
            {
              label: '分钟间隔',
              field: 'minuteStep',
              uiType: 'number',
              props: {
                min: 1,
                max: 59,
                step: 1,
              },
            },
            {
              label: '秒间隔',
              field: 'secondStep',
              uiType: 'number',
              props: {
                min: 1,
                max: 59,
                step: 1,
              },
            },
            {
              label: '隐藏禁用时间',
              field: 'hideDisabledOptions',
              uiType: 'checkbox',
              defaultValue: false,
            },
            {
              label: '显示此刻',
              field: 'showNow',
              uiType: 'checkbox',
              defaultValue: true,
            },
            {
              label: '输入只读',
              field: 'inputReadOnly',
              uiType: 'checkbox',
              defaultValue: false,
            },
            {
              label: '需要确认',
              field: 'needConfirm',
              uiType: 'checkbox',
              defaultValue: false,
            },
            {
              label: '尺寸',
              field: 'size',
              uiType: 'select',
              props: {
                options: [
                  {
                    label: '大',
                    value: 'large',
                  },
                  {
                    label: '中',
                    value: 'middle',
                  },
                  {
                    label: '小',
                    value: 'small',
                  },
                ],
              },
            },
            {
              label: '禁用',
              field: 'disabled',
              uiType: 'checkbox',
              defaultValue: false,
            },
            {
              label: '允许清除',
              field: 'allowClear',
              uiType: 'checkbox',
              defaultValue: true,
            },
            {
              label: '校验状态',
              field: 'status',
              uiType: 'select',
              props: {
                options: [
                  {
                    label: '默认',
                    value: undefined,
                  },
                  {
                    label: '错误',
                    value: 'error',
                  },
                  {
                    label: '警告',
                    value: 'warning',
                  },
                ],
              },
            },
            {
              label: '外观',
              field: 'variant',
              uiType: 'select',
              props: {
                options: [
                  {
                    label: '描边',
                    value: 'outlined',
                  },
                  {
                    label: '填充',
                    value: 'filled',
                  },
                  {
                    label: '无边框',
                    value: 'borderless',
                  },
                  {
                    label: '下划线',
                    value: 'underlined',
                  },
                ],
              },
            },
            {
              label: '弹层位置',
              field: 'placement',
              uiType: 'select',
              props: {
                options: [
                  {
                    label: '左下',
                    value: 'bottomLeft',
                  },
                  {
                    label: '右下',
                    value: 'bottomRight',
                  },
                  {
                    label: '左上',
                    value: 'topLeft',
                  },
                  {
                    label: '右上',
                    value: 'topRight',
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
