import { lazy } from 'react';
import { defineMaterial } from '@';
const material = defineMaterial({
  type: 'drawer',
  layout: { display: 'block' },
  title: '抽屉容器',
  defaultProps: {
    title: '抽屉',
    placement: 'right',
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
        name: 'onClose',
        description: '关闭请求',
        params: [{ description: '业务参数（event.payload）' }],
      },
      {
        name: 'afterOpenChange',
        description: '可见状态改变完成',
        params: [{ description: '业务参数（event.payload）' }],
      },
    ],
  },
  description: '抽屉容器的结构与展示属性。',
  keywords: ['抽屉容器', 'overlay'],
  role: 'overlay',
  acceptsChildren: true,
  usage: '配置抽屉容器的属性与展示行为。',
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
            field: 'placement',
            label: '位置',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '左侧',
                  value: 'left',
                },
                {
                  label: '右侧',
                  value: 'right',
                },
                {
                  label: '顶部',
                  value: 'top',
                },
                {
                  label: '底部',
                  value: 'bottom',
                },
              ],
            },
          },
          {
            schema: {
              anyOf: [
                { type: 'string', enum: ['default', 'large'] },
                { type: 'number', minimum: 1 },
              ],
            },
            field: 'size',
            linkageShow: [{ field: 'customSize', value: undefined }],
            label: '预设尺寸',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '默认',
                  value: 'default',
                },
                {
                  label: '大',
                  value: 'large',
                },
              ],
            },
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
            field: 'push',
            label: '嵌套抽屉推开父层',
            uiType: 'checkbox',
            defaultValue: true,
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
