import { lazy } from 'react';
import { defineMaterial } from '@';
import { tableManifest } from './manifest';
import { validateColumns, validateRows } from '../structured-data-validation';

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
            validateValue: validateColumns,
            label: '列配置',
            uiType: 'json',
          },
          {
            field: 'dataSource',
            validateValue: validateRows,
            label: '表格数据',
            uiType: 'json',
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
                  value: 'middle',
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
            field: 'enabledPagination',
            label: '开启分页',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'pageSize',
            label: '每页条数',
            uiType: 'number',
            linkageShow: [
              {
                field: 'enabledPagination',
                value: true,
              },
            ],
            props: {
              min: 1,
              step: 1,
            },
          },
          {
            field: 'paginationPosition',
            label: '分页位置',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '上左',
                  value: 'topLeft',
                },
                {
                  label: '上中',
                  value: 'topCenter',
                },
                {
                  label: '上右',
                  value: 'topRight',
                },
                {
                  label: '下左',
                  value: 'bottomLeft',
                },
                {
                  label: '下中',
                  value: 'bottomCenter',
                },
                {
                  label: '下右',
                  value: 'bottomRight',
                },
                {
                  label: '隐藏',
                  value: 'none',
                },
              ],
            },
            linkageShow: [
              {
                field: 'enabledPagination',
                value: true,
              },
            ],
          },
          {
            field: 'hideOnSinglePage',
            label: '单页隐藏分页',
            uiType: 'checkbox',
            defaultValue: false,
            linkageShow: [
              {
                field: 'enabledPagination',
                value: true,
              },
            ],
          },
          {
            field: 'showQuickJumper',
            label: '快速跳页',
            uiType: 'checkbox',
            defaultValue: false,
            linkageShow: [
              {
                field: 'enabledPagination',
                value: true,
              },
            ],
          },
          {
            field: 'showSizeChanger',
            label: '切换每页条数',
            uiType: 'checkbox',
            defaultValue: false,
            linkageShow: [
              {
                field: 'enabledPagination',
                value: true,
              },
            ],
          },
          {
            field: 'simplePagination',
            label: '简洁分页',
            uiType: 'checkbox',
            defaultValue: false,
            linkageShow: [
              {
                field: 'enabledPagination',
                value: true,
              },
            ],
          },
        ],
      },
    ],
  },
});
export default material;
