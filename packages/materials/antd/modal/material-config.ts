import { lazy } from 'react';
import type { Material } from '../../src/material';

const ModalMaterial: Material = {
  Component: lazy(() => import('./index')),
  title: '弹窗容器',
  type: 'modal',
  isContainer: true,
  defaultProps: {
    title: '弹窗标题',
  },
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            label: '标题',
            field: 'title',
            uiType: 'input',
            props: {
              placeholder: '请输入弹窗标题',
            },
          },
          {
            label: '宽度',
            field: 'width',
            uiType: 'number',
            props: {
              min: 200,
              max: 1200,
              step: 10,
              unit: 'px',
            },
          },
          {
            label: '取消文本',
            field: 'cancelText',
            uiType: 'input',
            props: {
              placeholder: '取消',
            },
          },
          {
            label: '确定文本',
            field: 'okText',
            uiType: 'input',
            props: {
              placeholder: '确定',
            },
          },
          {
            label: '居中显示',
            field: 'centered',
            uiType: 'checkbox',
          },
          {
            label: '遮罩可关闭',
            field: 'maskClosable',
            uiType: 'checkbox',
          },
          {
            label: '强制渲染',
            field: 'forceRender',
            uiType: 'checkbox',
          },
          {
            label: '显示遮罩',
            field: 'mask',
            uiType: 'checkbox',
          },
          {
            label: '键盘ESC关闭',
            field: 'keyboard',
            uiType: 'checkbox',
          },
        ],
      },
    ],
  },
};

export default ModalMaterial;
