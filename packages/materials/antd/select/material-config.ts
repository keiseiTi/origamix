// import { OptionsConfig } from '@/components/options-config';
import { lazy } from 'react';
import type { Material } from '../../src/material';
import { selectManifest } from '../manifest';

const SelectMaterial: Material = {
  Component: lazy(() => import('./index')),
  title: selectManifest.title,
  type: selectManifest.type,
  dropTypes: ['form'],
  defaultProps: selectManifest.defaultProps,
  contextConfig: {
    variables: [...selectManifest.context.variables],
    methods: selectManifest.context.methods.map((method) => ({
      ...method,
      params: method.params?.map((param) => ({ description: param.description ?? '' })),
    })),
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
