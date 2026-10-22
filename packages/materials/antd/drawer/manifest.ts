import { defineManifest } from '../manifest-definition';

export const drawerManifest = defineManifest({
  type: 'drawer',
  title: '抽屉容器',
  defaultProps: {
    open: false,
    placement: 'right',
    closable: true,
    mask: true,
    maskClosable: true,
    keyboard: true,
  },
  context: {
    variables: [
      {
        name: 'open',
        description: '是否打开',
      },
    ],
    writable: [
      {
        name: 'open',
        description: '是否打开',
      },
      {
        name: 'loading',
        description: '加载中',
      },
    ],
    values: [],
    methods: [
      {
        name: 'onClose',
        description: '关闭请求',
        params: [
          {
            description: '业务参数（event.payload）',
          },
        ],
      },
      {
        name: 'afterOpenChange',
        description: '可见状态改变完成',
        params: [
          {
            description: '业务参数（event.payload）',
          },
        ],
      },
    ],
  },
  description: '抽屉容器的结构与展示属性。',
  keywords: ['抽屉容器', 'overlay'],
  role: 'overlay',
  acceptsChildren: true,
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      open: {
        type: 'boolean',
      },
      closable: {
        type: 'boolean',
      },
      mask: {
        type: 'boolean',
      },
      maskClosable: {
        type: 'boolean',
      },
      keyboard: {
        type: 'boolean',
      },
      forceRender: {
        type: 'boolean',
      },
      destroyOnHidden: {
        type: 'boolean',
      },
      loading: {
        type: 'boolean',
      },
      zIndex: {
        type: 'integer',
        minimum: 0,
      },
      placement: {
        type: 'string',
        enum: ['left', 'right', 'top', 'bottom'],
      },
      size: {
        anyOf: [
          {
            type: 'string',
            enum: ['default', 'large'],
          },
          {
            type: 'number',
            minimum: 1,
          },
        ],
      },
      customSize: {
        type: 'number',
        minimum: 1,
      },
      resizable: {
        type: 'boolean',
      },
      push: {
        type: 'boolean',
      },
    },
    required: [],
  },
  usage: '配置抽屉容器的属性与展示行为。',
  constraints: ['不将实例或回调写入 Schema。'],
});
