import { defineSimpleManifest, emptyContext, objectSchema } from '../manifest-definition';

export const tabsManifest = defineSimpleManifest(
  {
    type: 'tabs',
    title: '标签选项卡',
    defaultProps: {},
    context: emptyContext,
  },
  {
    description: '在多个标签面板之间切换内容。',
    keywords: ['标签页', '选项卡', '切换'],
    role: 'layout',
    propsSchema: objectSchema({
      activeKey: { type: 'string' },
      defaultActiveKey: { type: 'string' },
      type: { type: 'string', enum: ['line', 'card', 'editable-card'] },
      size: { type: 'string', enum: ['large', 'middle', 'small'] },
      tabPosition: { type: 'string', enum: ['top', 'right', 'bottom', 'left'] },
      centered: { type: 'boolean' },
      destroyInactiveTabPane: { type: 'boolean' },
      items: { type: 'array', items: { type: 'object' } },
    }),
    acceptsChildren: true,
    allowedParentTypes: ['basicPage'],
    usage: '组织需要分类切换的页面内容。',
    constraints: ['标签项的 key 必须唯一。'],
  },
);
