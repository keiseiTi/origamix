import type { ComponentType, ReactNode } from 'react';
import type { LayoutNode, MaterialRegistry } from './core/types';

/** Stable material identity is shared by run and design rendering. */
export const MaterialView = ({
  id,
  type,
  components,
  props,
  children,
}: {
  id: string;
  type: string;
  components: MaterialRegistry;
  props: Record<string, unknown>;
  children?: ReactNode;
}): React.JSX.Element | null => {
  const Material = components[type] as ComponentType<Record<string, unknown>> | undefined;
  if (!Material) throw new Error(`未知物料：${type}`);
  return (
    <Material {...props} data-element-id={id}>
      {children}
    </Material>
  );
};
export const renderLayout = (
  nodes: LayoutNode[],
  render: (node: LayoutNode, children: ReactNode) => ReactNode,
): ReactNode =>
  nodes.map((node) =>
    render(node, node.children.length ? renderLayout(node.children, render) : undefined),
  );
