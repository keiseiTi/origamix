import type { MaterialEventProps } from '../../src/runtime-material';
import { useLayoutEffect } from 'react';
import { Table as AntdTable, theme, type TableProps, type TablePaginationConfig } from 'antd';
import type { RuntimeMaterialProps } from '@';
import { useRuntimeValue } from '../runtime-state';
export type IProps = MaterialEventProps<TableProps<Record<string, unknown>>, 'onChange'> &
  RuntimeMaterialProps & {
    scrollX?: number;
    scrollY?: number;
    emptyText?: string;
    paginationMode?: 'local' | 'remote';
  };
export const Table = (props: IProps) => {
  const {
    paginationMode = 'local',
    columns,
    loading = false,
    pagination,
    dataSource = [],
    onChange,
    scrollX,
    scrollY,
    scroll,
    emptyText,
    locale,
    om_setContextActions,
    om_setRuntimeState,
    om_mode,
    om_readonly,
    om_dropPlaceholder,
    ...rest
  } = props;

  const { token } = theme.useToken();
  const [page, setPage] = useRuntimeValue('pagination', pagination, false, om_setRuntimeState);
  useLayoutEffect(() => {
    om_setRuntimeState?.({ loading: Boolean(loading) });
  }, [loading, om_setRuntimeState]);
  useLayoutEffect(() => {
    if (!page || paginationMode === 'remote') return;
    const pageSize = Math.max(1, Math.trunc(page.pageSize ?? 10));
    const current = Math.max(
      1,
      Math.min(page.current ?? 1, Math.max(1, Math.ceil(dataSource.length / pageSize))),
    );
    if (page.total !== dataSource.length || page.current !== current || page.pageSize !== pageSize)
      setPage({ ...page, current, pageSize, total: dataSource.length });
  }, [dataSource.length, page, setPage, paginationMode]);
  return (
    <AntdTable
      {...rest}
      loading={loading}
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
              total: paginationMode === 'remote' ? (page && page.total) || 0 : dataSource.length,
            }
      }
      onChange={(next, _filters, _sorter, extra) => {
        const normalized = {
          ...(page || {}),
          pageSize: next.pageSize,
          current: next.pageSize !== (page && page.pageSize) ? 1 : next.current,
          total: paginationMode === 'remote' ? (page && page.total) || 0 : dataSource.length,
        };
        setPage(normalized);
        onChange?.({ pagination: normalized, action: extra.action });
      }}
    />
  );
};
export default Table;
