import { defineManifest } from '../manifest-definition';

export const modalManifest = defineManifest({
  type: 'modal',
  layout: { display: 'block' },
  title: '弹窗容器',
  defaultProps: {
    open: false,
    width: 520,
    showFooter: true,
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
        name: 'onOk',
        description: '确认',
        params: [
          {
            description: '业务参数（event.payload）',
          },
        ],
        linkageShow: [
          {
            field: 'showFooter',
            value: true,
          },
        ],
      },
      {
        name: 'onCancel',
        description: '取消或关闭',
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
  description: '弹窗容器的结构与展示属性。',
  keywords: ['弹窗容器', 'overlay'],
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
      width: {
        anyOf: [
          {
            type: 'number',
            minimum: 1,
          },
          {
            type: 'string',
          },
        ],
      },
      okType: {
        type: 'string',
        enum: ['primary', 'default', 'dashed', 'text', 'link'],
      },
      centered: {
        type: 'boolean',
      },
      confirmLoading: {
        type: 'boolean',
      },
      showFooter: {
        type: 'boolean',
      },
      okDisabled: {
        type: 'boolean',
      },
      cancelDisabled: {
        type: 'boolean',
      },
    },
    required: [],
  },
  usage: '配置弹窗容器的属性与展示行为。',
  constraints: ['不将实例或回调写入 Schema。'],
});
