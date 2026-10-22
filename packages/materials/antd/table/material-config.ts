import { TableRowsEditor, PaginationEditor } from '../../components/structured-editors';
import { ColumnsEditor } from '../../components/collection-editor';
import { lazy } from 'react';
import { defineMaterial } from '@';
import { tableManifest } from './manifest';
const material = defineMaterial({
  manifest: tableManifest,
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            field: 'rowKey',
            label: '行唯一标识字段',
            uiType: 'input',
          },
          {
            field: 'columns',
            label: '列配置',
            uiType: 'custom',
            render: ColumnsEditor,
          },
          {
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
            defaultValue: true,
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
