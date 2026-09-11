import { defineManifest, objectSchema } from '../manifest-definition';

export const tableManifest = defineManifest(
  {
    type: 'table',
    title: '表格',
    defaultProps: {
      rowKey: 'id',
      size: 'middle',
      columns: [
        { title: '列1', dataIndex: 'col1' },
        { title: '列2', dataIndex: 'col2' },
      ],
      enabledPagination: false,
    },
    context: {
      variables: [
        { name: 'dataSource', description: '数据源' },
        { name: 'loading', description: '加载中' },
        { name: 'bordered', description: '是否显示边框' },
      ],
      values: [],
      methods: [],
    },
  },
  {
    version: '1.0.0',
    description: '按列展示结构化列表数据。',
    keywords: ['表格', '列表', '数据'],
    role: 'display',
    acceptsChildren: false,
    propsSchema: objectSchema(
      {
        rowKey: { type: 'string', minLength: 1 },
        size: { type: 'string', enum: ['large', 'middle', 'small'] },
        columns: {
          type: 'array',
          items: objectSchema(
            {
              title: { type: 'string' },
              dataIndex: { type: 'string' },
              key: { type: 'string' },
            },
            ['title', 'dataIndex'],
          ),
        },
        dataSource: { type: 'array', items: { type: 'object' } },
        enabledPagination: { type: 'boolean' },
        bordered: { type: 'boolean' },
      },
      ['rowKey', 'columns'],
    ),
    usage: '用于展示具有稳定字段结构的数据集合。',
    constraints: ['rowKey 必须对应每行数据的唯一字段。', '列的 dataIndex 应对应数据字段。'],
  },
);
