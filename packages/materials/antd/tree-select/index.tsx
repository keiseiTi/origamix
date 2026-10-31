import React from 'react';
import type { RuntimeMaterialProps } from '@';
import { TreeSelect as AntdTreeSelect, type TreeSelectProps } from 'antd';

export type IProps = TreeSelectProps & RuntimeMaterialProps;

import { useRuntimeValue } from '../runtime-state';
const raw = (item: unknown): unknown =>
  item !== null && typeof item === 'object' ? (item as { value: unknown }).value : item;
export const TreeSelect = (props: IProps) => {
  const {
    value,
    defaultValue,
    onChange,
    fieldName,
    fieldRequired,
    fieldLabel,
    om_setRuntimeState,
    om_mode,
    om_readonly,
    om_dropPlaceholder,
    om_setContextActions,
    treeCheckStrictly,
    ...rest
  } = props;
  const [current, change] = useRuntimeValue(
    'value',
    value,
    defaultValue ?? (props.multiple || props.treeCheckable ? [] : null),
    om_setRuntimeState,
  );
  return (
    <AntdTreeSelect
      {...rest}
      treeCheckStrictly={treeCheckStrictly}
      value={
        treeCheckStrictly && Array.isArray(current)
          ? current.map((value: unknown) => ({ value }))
          : current
      }
      onChange={(next, labels, extra) => {
        const normalized = Array.isArray(next) ? next.map(raw) : (raw(next) ?? null);
        change(normalized);
        onChange?.(normalized, labels, extra);
      }}
    />
  );
};
export default TreeSelect;
