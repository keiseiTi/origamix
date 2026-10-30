import { TableRowsEditor, PaginationEditor } from '../../components/structured-editors';
import { ColumnsEditor } from '../../components/collection-editor';
import { lazy } from 'react';
import { defineMaterial } from '@';
const material = defineMaterial({
  type: 'table',
  layout: { display: 'block' },
  title: '表格',
  defaultProps: {
    rowKey: 'id',
    size: 'medium',
    columns: [
      { title: '列1', dataIndex: 'col1' },
      { title: '列2', dataIndex: 'col2' },
    ],
    showHeader: true,
    dataSource: [],
    pagination: false,
  },
  context: {
    variables: [
      { name: 'dataSource', description: '数据行' },
      { name: 'loading', description: '加载中' },
      { name: 'pagination.current', description: '当前页码' },
      { name: 'pagination.pageSize', description: '每页条数' },
      { name: 'pagination.total', description: '总条数' },
    ],
    writable: [
      { name: 'dataSource', description: '数据行' },
      { name: 'loading', description: '加载中' },
      { name: 'pagination', description: '分页' },
    ],
    values: [],
    methods: [
      {
        name: 'onChange',
        description: '分页变化',
        params: [{ description: '业务参数（event.payload）' }],
      },
    ],
  },
  description: '表格的结构与展示属性。',
  keywords: ['表格', 'display'],
  role: 'display',
  acceptsChildren: false,
  usage: '配置表格的属性与展示行为。',
  constraints: ['表格行与列的标识应保持稳定。'],
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            schema: { type: 'string', minLength: 1 },
            required: true,
            field: 'rowKey',
            label: '行唯一标识字段',
            uiType: 'input',
          },
          {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  title: { type: 'string', minLength: 1 },
                  dataIndex: { type: 'string', minLength: 1 },
                  key: { type: 'string', minLength: 1 },
                  width: { type: 'number', minimum: 1 },
                  align: { type: 'string', enum: ['left', 'center', 'right'] },
                  fixed: {
                    anyOf: [{ type: 'string', enum: ['left', 'right'] }, { type: 'boolean' }],
                  },
                  ellipsis: { type: 'boolean' },
                  hidden: { type: 'boolean' },
                },
                required: ['title', 'dataIndex'],
              },
            },
            required: true,
            field: 'columns',
            label: '列配置',
            uiType: 'custom',
            render: ColumnsEditor,
          },
          {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: {
                  anyOf: [
                    { type: 'string' },
                    { type: 'number' },
                    { type: 'boolean' },
                    { type: 'null' },
                  ],
                },
              },
            },
            field: 'dataSource',
            label: '表格数据',
            uiType: 'custom',
            render: TableRowsEditor,
          },
          {
            field: 'size',
            label: '尺寸',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '大',
                  value: 'large',
                },
                {
                  label: '中',
                  value: 'medium',
                },
                {
                  label: '小',
                  value: 'small',
                },
              ],
            },
          },
          {
            field: 'bordered',
            label: '显示边框',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'loading',
            label: '加载中',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'showHeader',
            label: '显示表头',
            uiType: 'checkbox',
          },
          {
            field: 'tableLayout',
            label: '表格布局',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '自动',
                  value: 'auto',
                },
                {
                  label: '固定',
                  value: 'fixed',
                },
              ],
            },
          },
          {
            field: 'scrollX',
            label: '横向滚动宽度',
            uiType: 'number',
            props: {
              min: 1,
            },
          },
          {
            field: 'scrollY',
            label: '纵向滚动高度',
            uiType: 'number',
            props: {
              min: 1,
            },
          },
          {
            field: 'sticky',
            label: '固定表头与滚动条',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'emptyText',
            label: '空数据提示',
            uiType: 'input',
          },
          {
            schema: {
              anyOf: [
                { const: false },
                {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    pageSize: { type: 'integer', minimum: 1 },
                    current: { type: 'integer', minimum: 1 },
                    total: { type: 'integer', minimum: 0 },
                    hideOnSinglePage: { type: 'boolean' },
                    showQuickJumper: { type: 'boolean' },
                    showSizeChanger: { type: 'boolean' },
                    simple: { type: 'boolean' },
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
                      maxItems: 1,
                    },
                  },
                },
              ],
            },
            field: 'pagination',
            label: '分页',
            uiType: 'custom',
            render: PaginationEditor,
          },
        ],
      },
    ],
  },
});
export default material;
