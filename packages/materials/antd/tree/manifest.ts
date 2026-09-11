import { defineSimpleManifest, objectSchema } from '../manifest-definition';

export const treeManifest = defineSimpleManifest(
  {
    type: 'tree',
    title: '树',
    defaultProps: {
      treeData: [
        {
          title: '节点1',
          key: '0-0',
          children: [
            { title: '子节点1', key: '0-0-0' },
            { title: '子节点2', key: '0-0-1' },
          ],
        },
        { title: '节点2', key: '0-1' },
      ],
    },
    context: {
      variables: [
        { name: 'treeData', description: '树节点数据' },
        { name: 'selectedKeys', description: '选中节点键数组' },
        { name: 'checkedKeys', description: '勾选节点键数组' },
      ],
      values: [],
      methods: [
        { name: 'onSelect', description: '节点选中时触发的回调' },
        { name: 'onCheck', description: '节点勾选时触发的回调' },
      ],
    },
  },
  {
    description: '展示层级树形数据。',
    keywords: ['树', '层级', '目录'],
    role: 'display',
    acceptsChildren: false,
    propsSchema: objectSchema({
      treeData: { type: 'array', items: { type: 'object' } },
      checkable: { type: 'boolean' },
      multiple: { type: 'boolean' },
      defaultExpandAll: { type: 'boolean' },
      checkStrictly: { type: 'boolean' },
      showLine: { type: 'boolean' },
      draggable: { type: 'boolean' },
    }),
    usage: '用于目录、组织或分类层级。',
    constraints: ['每个节点应具有唯一 key。'],
  },
);
