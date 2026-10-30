import { defineManifest } from '../manifest-definition';

export const tabsManifest = defineManifest({
  type: 'tabs',
  layout: { display: 'block' },
  title: '标签选项卡',
  defaultProps: {
    type: 'line',
    items: [
      {
        key: '1',
        label: '标签一',
        children: '标签一内容',
      },
      {
        key: '2',
        label: '标签二',
        children: '标签二内容',
      },
    ],
    hideAdd: true,
  },
  context: {
    variables: [
      {
        name: 'activeKey',
        description: '激活页签',
      },
    ],
    writable: [
      {
        name: 'activeKey',
        description: '激活页签',
      },
      {
        name: 'items',
        description: '页签',
      },
    ],
    values: [],
    methods: [
      {
        name: 'onChange',
        description: '值改变',
        params: [
          {
            description: '业务参数（event.payload）',
          },
        ],
      },
      {
        name: 'onEdit',
        description: '编辑页签',
        params: [
          {
            description: '业务参数（event.payload）',
          },
        ],
        linkageShow: [
          {
            field: 'type',
            value: 'editable-card',
          },
        ],
      },
    ],
  },
  description: '标签选项卡的结构与展示属性。',
  keywords: ['标签选项卡', 'layout'],
  role: 'layout',
  acceptsChildren: true,
  allowedParentTypes: ['basicPage', 'container', 'modal', 'drawer'],
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      activeKey: {
        type: 'string',
      },
      defaultActiveKey: {
        type: 'string',
      },
      type: {
        type: 'string',
        enum: ['line', 'card', 'editable-card'],
      },
      size: {
        type: 'string',
        enum: ['large', 'medium', 'small'],
      },
      tabPlacement: {
        type: 'string',
        enum: ['top', 'end', 'bottom', 'start'],
      },
      centered: {
        type: 'boolean',
      },
      destroyOnHidden: {
        type: 'boolean',
      },
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            key: {
              type: 'string',
              minLength: 1,
            },
            label: {
              type: 'string',
            },
            children: {
              type: 'string',
            },
            disabled: {
              type: 'boolean',
            },
            closable: {
              type: 'boolean',
            },
            forceRender: {
              type: 'boolean',
            },
            destroyOnHidden: {
              type: 'boolean',
            },
          },
          required: ['key', 'label'],
        },
      },
      tabBarGutter: {
        type: 'number',
        minimum: 0,
      },
      hideAdd: {
        type: 'boolean',
      },
      animated: {
        type: 'boolean',
      },
    },
    required: [],
  },
  usage: '页签项保存纯文本；Schema 子元素显示在第一个页签中。',
  constraints: ['页签 key 应唯一。'],
});
