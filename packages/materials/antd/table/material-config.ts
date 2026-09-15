import React from 'react';

const Table = React.lazy(() => import('./index'));
import type { Material } from '../../src/material';
import { tableManifest } from './manifest';
// import { ColumnConfig } from '@/components/column-config';
// import { PaginationConfig } from '@/components/pagination-config';

const TableMaterial: Material = {
  Component: Table,
  title: tableManifest.title,
  type: tableManifest.type,
  // isBlock: true,
  defaultProps: tableManifest.defaultProps,
  contextConfig: {
    variables: [...tableManifest.context.variables],
  },
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            label: '行 Key',
            field: 'rowKey',
            uiType: 'input',
            required: true,
            props: {
              placeholder: '数据行的唯一标识字段',
            },
          },
          {
            label: '表格大小',
            field: 'size',
            uiType: 'select',
            props: {
              options: [
                { label: '默认', value: 'middle' },
                { label: '小', value: 'small' },
                { label: '大', value: 'large' },
              ],
            },
          },
          // {
          //   label: '列配置',
          //   field: 'columns',
          //   uiType: 'custom',
          //   render: ColumnConfig,
          // },
          {
            label: '开启分页',
            field: 'enabledPagination',
            uiType: 'checkbox',
          },
          // {
          //   field: 'pagination',
          //   uiType: 'custom',
          //   render: PaginationConfig,
          //   linkageShow: [
          //     {
          //       field: 'enabledPagination',
          //       value: true,
          //     },
          //   ],
          // },

          {
            label: '边框',
            field: 'bordered',
            uiType: 'checkbox',
          },
        ],
      },
    ],
  },
};

export default TableMaterial;
