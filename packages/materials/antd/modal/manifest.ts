import { defineSimpleManifest } from '../manifest-definition';

export const modalManifest = defineSimpleManifest(
  {
    type: 'modal',
    title: '弹窗容器',
    defaultProps: {
      title: '弹窗标题',
      open: false,
      width: 520,
      showFooter: true,
      closable: true,
      mask: true,
      maskClosable: true,
      keyboard: true,
    },
    context: {
      variables: [],
      values: [],
      methods: [],
    },
  },
  {
    description: '弹窗容器的结构与展示属性。',
    keywords: ['弹窗容器', 'overlay'],
    role: 'overlay',
    acceptsChildren: true,
    propsSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: {
          type: 'string',
        },
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
        cancelText: {
          type: 'string',
        },
        okText: {
          type: 'string',
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
        destroyOnClose: {
          type: 'boolean',
        },
      },
    },
    usage: '配置弹窗容器的属性与展示行为。',
    constraints: ['不将实例或回调写入 Schema。'],
  },
);
