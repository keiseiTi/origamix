import React from 'react';

const Textarea = React.lazy(() => import('./index'));
import type { Material } from '../interfaces/material';
import { AutoSize } from './mods/auto-size';

const TextareaMaterial: Material = {
  Component: Textarea,
  title: '文本域',
  type: 'textarea',
  dropTypes: ['form'],
  defaultProps: {
    placeholder: '请输入内容',
    size: 'middle',
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
              step: 1,
            },
          },
          {
            label: '显示字数统计',
            field: 'showCount',
            uiType: 'checkbox',
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
            field: 'autoSize',
            uiType: 'custom',
            render: AutoSize,
          },
        ],
      },
    ],
  },
};

export default TextareaMaterial;
