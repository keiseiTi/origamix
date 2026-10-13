import { defineSimpleManifest } from '../manifest-definition';

export const drawerManifest = defineSimpleManifest(
  {
    type: 'drawer',
    title: '抽屉容器',
    defaultProps: {
      title: '抽屉标题',
      open: false,
      placement: 'right',
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
    description: '抽屉容器的结构与展示属性。',
    keywords: ['抽屉容器', 'overlay'],
    role: 'overlay',
    acceptsChildren: true,
    documentationUrl: 'https://ant.design/components/drawer/#api',
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
        height: {
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
        resizable: {
          type: 'boolean',
        },
        push: {
          type: 'boolean',
        },
        extra: {
          type: 'string',
        },
        footer: {
          type: 'string',
        },
        destroyOnClose: {
          type: 'boolean',
        },
      },
    },
    usage: '配置抽屉容器的属性与展示行为。',
    constraints: ['不将实例或回调写入 Schema。'],
  },
);
