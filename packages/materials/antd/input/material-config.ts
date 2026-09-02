import { lazy } from 'react';
import type { Material } from '../../src/material';

const InputMaterial: Material = {
  Component: lazy(() => import('./index')),
  title: '输入框',
  type: 'input',
  dropTypes: ['form'],
  defaultProps: {
    placeholder: '请输入内容',
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
      {
        name: 'onPressEnter',
        description: '回车的回调',
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
