import { defineManifest, objectSchema } from '../manifest-definition';

export const switchManifest = defineManifest(
  {
    type: 'switch',
    title: '开关',
    defaultProps: {},
    context: {
      variables: [
        { name: 'checked', description: '是否选中' },
        { name: 'disabled', description: '是否禁用' },
        { name: 'loading', description: '加载中的开关' },
      ],
      values: [],
      methods: [
        {
          name: 'onChange',
          description: '值改变时的回调',
          params: [{ description: '事件参数' }],
        },
      ],
    },
  },
  {
    version: '1.0.0',
    description: '录入开启或关闭两种状态。',
    keywords: ['开关', '布尔值', '启用'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    propsSchema: objectSchema({ defaultChecked: { type: 'boolean' } }),
    usage: '用于启用、停用等布尔字段。',
    constraints: ['必须置于 form 中。'],
  },
);
