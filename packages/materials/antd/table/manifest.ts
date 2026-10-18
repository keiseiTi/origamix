import { defineManifest } from '../manifest-definition';

export const tableManifest = defineManifest({
  type: 'table',
  title: '表格',
  defaultProps: {
    rowKey: 'id',
    size: 'middle',
    columns: [
      {
        title: '列1',
        dataIndex: 'col1',
      },
      {
        title: '列2',
        dataIndex: 'col2',
      },
    ],
    enabledPagination: false,
    showHeader: true,
    dataSource: [],
  },
  context: {
    variables: [
      {
        name: 'dataSource',
        description: '数据源',
      },
      {
        name: 'loading',
        description: '加载中',
      },
      {
        name: 'bordered',
        description: '是否显示边框',
      },
    ],
    values: [],
    methods: [],
  },
  description: '表格的结构与展示属性。',
  keywords: ['表格', 'display'],
  role: 'display',
  acceptsChildren: false,
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      rowKey: {
        type: 'string',
        minLength: 1,
      },
      size: {
        type: 'string',
        enum: ['large', 'middle', 'small'],
      },
      columns: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: {
              type: 'string',
            },
            dataIndex: {
              type: 'string',
            },
            key: {
              type: 'string',
            },
            width: {
              type: 'number',
              minimum: 1,
            },
            align: {
              type: 'string',
              enum: ['left', 'center', 'right'],
            },
            fixed: {
              anyOf: [
                {
                  type: 'string',
                  enum: ['left', 'right'],
                },
                {
                  type: 'boolean',
                },
              ],
            },
            ellipsis: {
              type: 'boolean',
            },
            hidden: {
              type: 'boolean',
            },
          },
          required: ['title', 'dataIndex'],
        },
      },
      dataSource: {
        type: 'array',
        items: {
          type: 'object',
        },
      },
      enabledPagination: {
        type: 'boolean',
      },
      pagination: {
        anyOf: [
          {
            type: 'boolean',
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              pageSize: {
                type: 'integer',
                minimum: 1,
              },
              current: {
                type: 'integer',
                minimum: 1,
              },
              total: {
                type: 'integer',
                minimum: 0,
              },
              hideOnSinglePage: {
                type: 'boolean',
              },
              showQuickJumper: {
                type: 'boolean',
              },
              showSizeChanger: {
                type: 'boolean',
              },
              simple: {
                type: 'boolean',
              },
              position: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: [
                    'topLeft',
                    'topCenter',
                    'topRight',
                    'bottomLeft',
                    'bottomCenter',
                    'bottomRight',
                    'none',
                  ],
                },
              },
            },
          },
        ],
      },
      pageSize: {
        type: 'integer',
        minimum: 1,
      },
      paginationPosition: {
        type: 'string',
        enum: [
          'topLeft',
          'topCenter',
          'topRight',
          'bottomLeft',
          'bottomCenter',
          'bottomRight',
          'none',
        ],
      },
      hideOnSinglePage: {
        type: 'boolean',
      },
      showQuickJumper: {
        type: 'boolean',
      },
      showSizeChanger: {
        type: 'boolean',
      },
      simplePagination: {
        type: 'boolean',
      },
      bordered: {
        type: 'boolean',
      },
      loading: {
        type: 'boolean',
      },
      showHeader: {
        type: 'boolean',
      },
      tableLayout: {
        type: 'string',
        enum: ['auto', 'fixed'],
      },
      scrollX: {
        type: 'number',
        minimum: 1,
      },
      scrollY: {
        type: 'number',
        minimum: 1,
      },
      sticky: {
        type: 'boolean',
      },
      emptyText: {
        type: 'string',
      },
    },
    required: ['rowKey', 'columns'],
  },
  usage: '配置表格的属性与展示行为。',
  constraints: ['表格行与列的标识应保持稳定。'],
});
