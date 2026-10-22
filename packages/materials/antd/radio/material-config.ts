import { OptionsEditor } from '../../components/collection-editor';
import { lazy } from 'react';
import { defineMaterial } from '@';
import { radioManifest } from './manifest';
const material = defineMaterial({
  manifest: radioManifest,
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          { field: 'options', label: '选项配置', uiType: 'custom', render: OptionsEditor },
          {
            label: '禁用',
            field: 'disabled',
            uiType: 'checkbox',
          },
          {
            label: '表单字段名',
            field: 'name',
            uiType: 'input',
          },
          {
            label: '选项样式',
            field: 'optionType',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '单选框',
                  value: 'default',
                },
                {
                  label: '按钮',
                  value: 'button',
                },
              ],
            },
          },
          {
            label: '按钮风格',
            field: 'buttonStyle',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '描边',
                  value: 'outline',
                },
                {
                  label: '填充',
                  value: 'solid',
                },
              ],
            },
            linkageShow: [
              {
                field: 'optionType',
                value: 'button',
              },
            ],
          },
          {
            label: '按钮尺寸',
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
                  value: 'medium',
                },
                {
                  label: '小',
                  value: 'small',
                },
              ],
            },
            linkageShow: [
              {
                field: 'optionType',
                value: 'button',
              },
            ],
          },
          {
            label: '撑满宽度',
            field: 'block',
            uiType: 'checkbox',
          },
          {
            label: '排列方向',
            field: 'orientation',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '横向',
                  value: 'horizontal',
                },
                {
                  label: '纵向',
                  value: 'vertical',
                },
              ],
            },
          },
        ],
      },
    ],
  },
});
export default material;
