import { defineSimpleManifest } from '../manifest-definition';

export const tabsManifest = defineSimpleManifest(
  {
    type: 'tabs',
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
      variables: [],
      values: [],
      methods: [],
    },
  },
  {
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
          enum: ['large', 'middle', 'small'],
        },
        tabPosition: {
          type: 'string',
          enum: ['top', 'right', 'bottom', 'left'],
        },
        tabPlacement: {
          type: 'string',
          enum: ['top', 'end', 'bottom', 'start'],
        },
        centered: {
          type: 'boolean',
        },
        destroyInactiveTabPane: {
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
    },
    usage: '页签项保存纯文本；Schema 子元素显示在第一个页签中。',
    constraints: ['页签 key 应唯一。'],
  },
);
