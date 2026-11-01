import type { MaterialEventProps } from '../../src/runtime-material';
import type { Key } from 'react';
import { Tree as AntdTree, type TreeProps } from 'antd';
import type { RuntimeMaterialProps } from '@';
import { useRuntimeValue } from '../runtime-state';
export type IProps = MaterialEventProps<TreeProps, 'onSelect' | 'onCheck' | 'onExpand'> &
  RuntimeMaterialProps;
export const Tree = (props: IProps) => {
  const {
    selectedKeys,
    checkedKeys,
    expandedKeys,
    defaultSelectedKeys,
    defaultCheckedKeys,
    defaultExpandedKeys,
    defaultExpandAll,
    onSelect,
    onCheck,
    onExpand,
    om_setContextActions,
    om_setRuntimeState,
    om_readonly,
    om_dropPlaceholder,
    om_mode,
    ...rest
  } = props;

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
    () => {
      if (!defaultExpandAll) return defaultExpandedKeys ?? [];
      const keys: Key[] = [];
      const visit = (nodes: NonNullable<TreeProps['treeData']>) => {
        for (const node of nodes) {
          keys.push(node.key);
          if (node.children) visit(node.children);
        }
      };
      visit(props.treeData ?? []);
      return keys;
    },
    om_setRuntimeState,
  );
  return (
    <AntdTree
      {...rest}
      selectedKeys={selected}
      checkedKeys={checked}
      expandedKeys={expanded}
      onSelect={(next) => {
        select(next);
        onSelect?.({ selectedKeys: next });
      }}
      onCheck={(next) => {
        check(Array.isArray(next) ? next : next.checked);
        onCheck?.({ checkedKeys: Array.isArray(next) ? next : next.checked });
      }}
      onExpand={(next) => {
        expand(next);
        onExpand?.({ expandedKeys: next });
      }}
    />
  );
};
export default Tree;
