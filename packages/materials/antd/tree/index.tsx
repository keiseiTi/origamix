import type { Key } from 'react';
import { Tree as AntdTree, type TreeProps } from 'antd';
import type { RuntimeMaterialProps } from '@';
import { useRuntimeValue } from '../runtime-state';
export type IProps = TreeProps & RuntimeMaterialProps;
export const Tree = ({
  selectedKeys,
  checkedKeys,
  expandedKeys,
  defaultSelectedKeys,
  defaultCheckedKeys,
  defaultExpandedKeys,
  onSelect,
  onCheck,
  onExpand,
  om_setContextActions,
  om_setRuntimeState,
  om_readonly,
  om_dropPlaceholder,
  om_mode,
  ...rest
}: IProps) => {
  const allKeys: Key[] = [];
  const visit = (nodes: NonNullable<TreeProps['treeData']>) =>
    nodes.forEach((node) => {
      allKeys.push(node.key);
      if (node.children) visit(node.children);
    });
  visit(rest.treeData ?? []);
  const [selected, select] = useRuntimeValue<Key[]>(
    'selectedKeys',
    selectedKeys,
    defaultSelectedKeys ?? [],
    om_setRuntimeState,
  );
  const [checked, check] = useRuntimeValue<Key[]>(
    'checkedKeys',
    Array.isArray(checkedKeys) ? checkedKeys : checkedKeys?.checked,
    defaultCheckedKeys ?? [],
    om_setRuntimeState,
  );
  const [expanded, expand] = useRuntimeValue<Key[]>(
    'expandedKeys',
    expandedKeys,
    rest.defaultExpandAll ? allKeys : (defaultExpandedKeys ?? []),
    om_setRuntimeState,
  );
  return (
    <AntdTree
      {...rest}
      selectedKeys={selected}
      checkedKeys={checked}
      expandedKeys={expanded}
      onSelect={(next, info) => {
        select(next);
        onSelect?.(next, info);
      }}
      onCheck={(next, info) => {
        check(Array.isArray(next) ? next : next.checked);
        onCheck?.(next, info);
      }}
      onExpand={(next, info) => {
        expand(next);
        onExpand?.(next, info);
      }}
    />
  );
};
export default Tree;
