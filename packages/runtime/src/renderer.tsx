import { getMaterialDisplay, type MaterialLayout } from '@origamix/shared';
import type { ComponentType, ReactNode, HTMLAttributes, RefAttributes, CSSProperties } from 'react';
import type { LayoutNode, MaterialRegistry } from './core/types';

/** Stable material identity is shared by run and design rendering. */
export const MaterialView = ({
  id,
  type,
  components,
  props,
  children,
  frameProps,
  framePlacement,
  root,
}: {
  id: string;
  type: string;
  components: MaterialRegistry;
  props: Record<string, unknown>;
  children?: ReactNode;
  frameProps?: HTMLAttributes<HTMLDivElement> & RefAttributes<HTMLDivElement>;
  root?: boolean;
  framePlacement?: 'content';
}): React.JSX.Element | null => {
  const Material = components[type] as
    (ComponentType<Record<string, unknown>> & { origamixLayout?: MaterialLayout }) | undefined;
  if (!Material) throw new Error(`未知物料：${type}`);
  const {
    layoutWidth,
    layoutHeight,
    layoutFixedWidth,
    layoutFixedHeight,
    layoutGrow,
    layoutAlignSelf,
    ...materialProps
  } = props;
  const block = getMaterialDisplay(Material.origamixLayout, props) === 'block';
  const finiteSize = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
  const style: CSSProperties = {
    display: block ? 'block' : 'inline-block',
    verticalAlign: 'top',
    minWidth: 0,
    maxWidth: '100%',
    boxSizing: 'border-box',
    width:
      layoutWidth === 'fixed'
        ? (finiteSize(layoutFixedWidth) ?? 200)
        : layoutWidth === 'fill'
          ? '100%'
          : layoutWidth === 'auto'
            ? block || layoutAlignSelf === 'stretch'
              ? 'auto'
              : 'fit-content'
            : block
              ? '100%'
              : layoutAlignSelf === 'stretch'
                ? 'auto'
                : 'fit-content',
    height:
      layoutHeight === 'fixed'
        ? (finiteSize(layoutFixedHeight) ?? 200)
        : layoutHeight === 'fill' || (root && layoutHeight === undefined)
          ? '100%'
          : undefined,
    flexGrow: finiteSize(layoutGrow),
    flexShrink: layoutWidth === 'fixed' || !block ? 0 : 1,
    alignSelf: (['auto', 'flex-start', 'center', 'flex-end', 'stretch'].includes(
      String(layoutAlignSelf),
    )
      ? layoutAlignSelf
      : undefined) as CSSProperties['alignSelf'],
  };
  const renderFrame = (content: ReactNode) => (
    <>
      {root && (
        <style>{`
        [data-origamix-layout] > :first-child { box-sizing: border-box; max-width: 100%; }
        [data-origamix-layout][data-layout-width="fill"] > :first-child,
        [data-origamix-layout][data-layout-width="fixed"] > :first-child { width: 100% !important; }
        [data-origamix-layout][data-layout-height="fill"] > :first-child,
        [data-origamix-layout][data-layout-height="fixed"] > :first-child { height: 100% !important; min-height: 0; }
      `}</style>
      )}
      <div
        {...frameProps}
        data-element-id={id}
        data-origamix-layout='true'
        data-layout-width={
          layoutWidth === 'fixed'
            ? 'fixed'
            : layoutWidth === 'fill' ||
                layoutAlignSelf === 'stretch' ||
                (finiteSize(layoutGrow) ?? 0) > 0
              ? 'fill'
              : layoutWidth === 'auto'
                ? undefined
                : block
                  ? 'fill'
                  : undefined
        }
        data-layout-height={layoutHeight ?? (root ? 'fill' : undefined)}
        data-material-display={block ? 'block' : 'inline'}
        style={{ ...style, ...frameProps?.style }}
      >
        {content}
      </div>
    </>
  );
  if (framePlacement === 'content' && props.om_mode === 'design') {
    return (
      <Material {...materialProps} om_renderDesignFrame={renderFrame}>
        {children}
      </Material>
    );
  }
  return renderFrame(
    <Material {...materialProps} data-element-id={id}>
      {children}
    </Material>,
  );
};
export const renderLayout = (
  nodes: LayoutNode[],
  render: (node: LayoutNode, children: ReactNode) => ReactNode,
): ReactNode =>
  nodes.map((node) =>
    render(node, node.children.length ? renderLayout(node.children, render) : undefined),
  );
