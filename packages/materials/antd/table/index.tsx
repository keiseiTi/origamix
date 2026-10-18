import React from 'react';
import { Table as AntdTable, theme, type TableProps } from 'antd';
import type { RuntimeMaterialProps } from '@';

export type IProps = TableProps<Record<string, unknown>> &
  RuntimeMaterialProps & {
    enabledPagination?: boolean;
    pageSize?: number;
    paginationPosition?:
      'topLeft' | 'topCenter' | 'topRight' | 'bottomLeft' | 'bottomCenter' | 'bottomRight' | 'none';
    hideOnSinglePage?: boolean;
    showQuickJumper?: boolean;
    showSizeChanger?: boolean;
    simplePagination?: boolean;
    scrollX?: number;
    scrollY?: number;
    emptyText?: string;
  };

export const Table = ({
  enabledPagination,
  pagination,
  pageSize,
  paginationPosition,
  hideOnSinglePage,
  showQuickJumper,
  showSizeChanger,
  simplePagination,
  scrollX,
  scrollY,
  scroll,
  emptyText,
  locale,
  tg_setContextValues,
  ...rest
}: IProps) => {
  const { token } = theme.useToken();
  return (
    <AntdTable
      {...rest}
      style={{ backgroundColor: token.colorBgContainer, color: token.colorText, ...rest.style }}
      scroll={{
        ...scroll,
        ...(scrollX !== undefined ? { x: scrollX } : {}),
        ...(scrollY !== undefined ? { y: scrollY } : {}),
      }}
      locale={{ ...locale, ...(emptyText !== undefined ? { emptyText } : {}) }}
      pagination={
        enabledPagination
          ? {
              pageSize: 10,
              ...(typeof pagination === 'object' ? pagination : {}),
              ...(pageSize !== undefined ? { pageSize } : {}),
              ...(paginationPosition ? { position: [paginationPosition] } : {}),
              ...(hideOnSinglePage !== undefined ? { hideOnSinglePage } : {}),
              ...(showQuickJumper !== undefined ? { showQuickJumper } : {}),
              ...(showSizeChanger !== undefined ? { showSizeChanger } : {}),
              ...(simplePagination !== undefined ? { simple: simplePagination } : {}),
            }
          : false
      }
    />
  );
};
export default Table;
