import { lazy } from 'react';
import type { Material } from '../../src/material';
import { inputManifest } from './manifest';

const InputMaterial: Material = {
  Component: lazy(() => import('./index')),
  title: inputManifest.title,
  type: inputManifest.type,
  dropTypes: ['form'],
  defaultProps: inputManifest.defaultProps,
  contextConfig: {
    variables: [...inputManifest.context.variables],
    methods: inputManifest.context.methods.map((method) => ({
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
            label: '输入类型',
            field: 'type',
            uiType: 'select',
            props: {
              options: [
                { label: '文本', value: 'text' },
                { label: '密码', value: 'password' },
                { label: '邮箱', value: 'email' },
              ],
            },
          },
          {
            label: '最大长度',
            field: 'maxLength',
            uiType: 'number',
            props: {
              min: 0,
              max: 1000,
              step: 1,
            },
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
          {
            label: '显示字数',
            field: 'showCount',
            uiType: 'checkbox',
          },
        ],
      },
    ],
  },
};

export default InputMaterial;
