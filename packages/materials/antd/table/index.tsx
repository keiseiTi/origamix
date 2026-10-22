import { useLayoutEffect } from 'react';
import { Table as AntdTable, theme, type TableProps, type TablePaginationConfig } from 'antd';
import type { RuntimeMaterialProps } from '@';
import { useRuntimeValue } from '../runtime-state';
export type IProps = TableProps<Record<string, unknown>> &
  RuntimeMaterialProps & { scrollX?: number; scrollY?: number; emptyText?: string };
export const Table = ({
  columns,
  pagination,
  dataSource = [],
  onChange,
  scrollX,
  scrollY,
  scroll,
  emptyText,
  locale,
  tg_setContextValues,
  tg_setRuntimeState,
  ...rest
}: IProps) => {
  const { token } = theme.useToken();
  const [page, setPage] = useRuntimeValue('pagination', pagination, false, tg_setRuntimeState);
  useLayoutEffect(() => {
    if (!page) return;
    const pageSize = Math.max(1, Math.trunc(page.pageSize ?? 10));
    const current = Math.max(
      1,
      Math.min(page.current ?? 1, Math.max(1, Math.ceil(dataSource.length / pageSize))),
    );
    if (page.total !== dataSource.length || page.current !== current || page.pageSize !== pageSize)
      setPage({ ...page, current, pageSize, total: dataSource.length });
  }, [dataSource.length, page, setPage]);
  return (
    <AntdTable
      {...rest}
      dataSource={dataSource}
      columns={columns?.map((column) => ({
        ...column,
        key: column.key ?? ('dataIndex' in column ? String(column.dataIndex) : undefined),
        ...(!('children' in column) && !column.render
          ? {
              render: (value: unknown) =>
                typeof value === 'boolean' ? String(value) : (value as React.ReactNode),
            }
          : {}),
      }))}
      style={{ backgroundColor: token.colorBgContainer, color: token.colorText }}
      scroll={{
        ...scroll,
        ...(scrollX !== undefined ? { x: scrollX } : {}),
        ...(scrollY !== undefined ? { y: scrollY } : {}),
      }}
      locale={{ ...locale, ...(emptyText !== undefined ? { emptyText } : {}) }}
      pagination={
        page === false
          ? false
          : {
              ...page,
              position: undefined,
              placement: page?.position?.map((position) =>
                position.replace('Left', 'Start').replace('Right', 'End'),
              ) as TablePaginationConfig['placement'],
              total: dataSource.length,
            }
      }
      onChange={(next, filters, sorter, extra) => {
        const normalized = {
          ...(page || {}),
          pageSize: next.pageSize,
          current: next.pageSize !== (page && page.pageSize) ? 1 : next.current,
          total: dataSource.length,
        };
        setPage(normalized);
        onChange?.(normalized, filters, sorter, extra);
      }}
    />
  );
};
export default Table;
