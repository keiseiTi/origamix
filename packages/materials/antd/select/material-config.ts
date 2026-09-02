// import { OptionsConfig } from '@/components/options-config';
import { lazy } from 'react';
import type { Material } from '../../src/material';

const SelectMaterial: Material = {
  Component: lazy(() => import('./index')),
  title: '选择器',
  type: 'select',
  dropTypes: ['form'],
  defaultProps: {
    placeholder: '请选择',
    size: 'middle',
    options: [
      {
        label: '选项一',
        value: 'option1',
      },
      {
        label: '选项二',
        value: 'option2',
      },
    ],
  },
  contextConfig: {
    variables: [
      {
        name: 'value',
        description: '当前值',
      },
      {
        name: 'disabled',
        description: '是否禁用',
      },
      {
        name: 'options',
        description: '选项',
      },
    ],
    methods: [
      {
        name: 'onChange',
        description: '值改变时的回调',
        params: [
          {
            description: '事件参数',
          },
        ],
      },
    ],
  },
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            label: '模式',
            field: 'mode',
            uiType: 'select',
            props: {
              allowClear: true,
              options: [
                { label: '多选', value: 'multiple' },
                { label: '标签', value: 'tags' },
              ],
            },
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
          // {
          //   field: 'options',
          //   uiType: 'custom',
          //   render: OptionsConfig,
          // },
        ],
      },
    ],
  },
};

export default SelectMaterial;
