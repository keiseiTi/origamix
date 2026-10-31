import { lazy } from 'react';
import { defineMaterial } from '@';
const material = defineMaterial({
  type: 'modal',
  layout: { display: 'block' },
  title: '弹窗容器',
  defaultProps: {
    title: '弹窗',
    width: 520,
    showFooter: true,
    closable: true,
    mask: true,
    maskClosable: true,
  },
  context: {
    variables: [{ name: 'open', description: '是否打开' }],
    writable: [
      { name: 'open', description: '是否打开' },
      { name: 'loading', description: '加载中' },
    ],
    actions: [],
    events: [
      {
        name: 'onOk',
        description: '确认',
        params: [{ description: '业务参数（event.payload）' }],
        linkageShow: [{ field: 'showFooter', value: true }],
      },
      {
        name: 'onCancel',
        description: '取消或关闭',
        params: [{ description: '业务参数（event.payload）' }],
      },
      {
        name: 'afterOpenChange',
        description: '可见状态改变完成',
        params: [{ description: '业务参数（event.payload）' }],
      },
    ],
  },
  description: '弹窗容器的结构与展示属性。',
  keywords: ['弹窗容器', 'overlay'],
  role: 'overlay',
  acceptsChildren: true,
  usage: '配置弹窗容器的属性与展示行为。',
  constraints: [
    '仅允许放在 layout.root 的直接子节点中，与根节点的物料类型无关。',
    '不将实例或回调写入 Schema。',
  ],
  Component: lazy(() => import('./index')),
  editorConfig: {
    presentation: 'overlay',
    panels: [
      {
        title: '属性',
        configs: [
          { field: 'title', label: '标题', uiType: 'input' },
          {
            schema: { anyOf: [{ type: 'number', minimum: 1 }, { type: 'string' }] },
            field: 'width',
            label: '宽度',
            uiType: 'number',
            props: {
              min: 1,
            },
          },
          {
            field: 'centered',
            label: '居中显示',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'closable',
            label: '显示关闭按钮',
            uiType: 'checkbox',
          },
          {
            field: 'mask',
            label: '显示遮罩',
            uiType: 'checkbox',
          },
          {
            field: 'maskClosable',
            label: '点击遮罩关闭',
            uiType: 'checkbox',
            linkageShow: [
              {
                field: 'mask',
                value: true,
              },
            ],
          },
          {
            field: 'showFooter',
            label: '显示底部按钮',
            uiType: 'checkbox',
          },
          {
            field: 'okType',
            label: '确定按钮类型',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '主要',
                  value: 'primary',
                },
                {
                  label: '默认',
                  value: 'default',
                },
                {
                  label: '虚线',
                  value: 'dashed',
                },
                {
                  label: '文本',
                  value: 'text',
                },
                {
                  label: '链接',
                  value: 'link',
                },
              ],
            },
            linkageShow: [
              {
                field: 'showFooter',
                value: true,
              },
            ],
          },
          {
            field: 'confirmLoading',
            label: '确定按钮加载中',
            uiType: 'checkbox',
            defaultValue: false,
            linkageShow: [
              {
                field: 'showFooter',
                value: true,
              },
            ],
          },
          {
            field: 'forceRender',
            label: '预先渲染内容',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'destroyOnHidden',
            label: '关闭后销毁内容',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            schema: { type: 'integer', minimum: 0 },
            field: 'zIndex',
            label: '浮层层级',
            uiType: 'number',
            props: {
              min: 0,
              step: 1,
            },
          },
        ],
      },
    ],
  },
});
export default material;
