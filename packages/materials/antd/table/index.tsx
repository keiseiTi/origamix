import React, { useMemo } from 'react';
import { Table as AntdTable, type TableProps, type TablePaginationConfig } from 'antd';
// import type { ColumnItem } from '@/components/column-config';
// import type { PaginationConfig } from '@/components/pagination-config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IProps = TableProps<any> & {
  // columns?: ColumnItem[];
  // pagination?: PaginationConfig;
  enabledPagination?: boolean;
};

export const Table = (props: IProps) => {
  const { columns, pagination: paginationConfig, enabledPagination, rowKey, ...restProps } = props;

  // 处理列配置
  // const columns = useMemo(() => {
  //   if (!columnConfig || columnConfig.length === 0) return undefined;

  //   return columnConfig.map(col => ({
  //     title: col.title,
  //     dataIndex: col.dataIndex,
  //     key: col.dataIndex,
  //     width: col.width,
  //     align: col.align,
  //     fixed: col.fixed || undefined,
  //     ellipsis: col.ellipsis,
  //   }));
  // }, [columnConfig]);

  // 处理分页配置
  const pagination = useMemo((): TablePaginationConfig | false => {
    // 如果没有启用分页，返回 false
    if (!enabledPagination) {
      return false;
    }

    // 如果启用了分页但没有配置，使用默认配置
    if (!paginationConfig) {
      return {
        pageSize: 10,
        position: ['bottomRight'],
        hideOnSinglePage: false,
        showQuickJumper: false,
      };
    }

    // 使用自定义配置
    return {
      pageSize: paginationConfig.pageSize ?? 10,
      // position: [
      //   paginationConfig.position === 'start'
      //     ? 'bottomLeft'
      //     : paginationConfig.position === 'center'
      //       ? 'bottomCenter'
      //       : 'bottomRight',
      // ] as any,
      hideOnSinglePage: paginationConfig.hideOnSinglePage ?? false,
      showQuickJumper: paginationConfig.showQuickJumper ?? false,
    };
  }, [enabledPagination, paginationConfig]);

  return <AntdTable rowKey={rowKey} columns={columns} pagination={pagination} {...restProps} />;
};

export default Table;
