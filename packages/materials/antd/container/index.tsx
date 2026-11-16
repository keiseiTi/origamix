import { getContainerStyle, type ContainerLayoutProps } from '../container-layout';
import { MaterialGrid, type GridColumns } from '../grid-layout';
import React from 'react';
import type { RuntimeMaterialProps as MaterialComponentProps } from '@';

export interface IProps extends MaterialComponentProps, ContainerLayoutProps {
  ref?: React.Ref<HTMLDivElement>;
  children?: React.ReactNode;
  margin?: number | string;
  padding?: number | string;
  heightConfig?: 'fixed' | 'auto';
  height?: number | string;
  gridColumns?: GridColumns;
}

// Ref remains available to component consumers; Editor targets the shared layout frame.
export const Container = (props: IProps) => {
  const {
    ref,
    children,
    margin,
    padding,
    heightConfig,
    height,
    om_dropPlaceholder,
    om_setContextActions,
    om_setRuntimeState,
    om_mode,
    om_readonly,
    layoutMode,
    display,
    gridColumns = '2',
    flexDirection,
    gap,
    flexWrap,
    alignItems,
    justifyContent,
    ...rest
  } = props;

  const style: React.CSSProperties = {
    ...getContainerStyle({
      layoutMode,
      display,
      flexDirection,
      gap,
      flexWrap,
      alignItems,
      justifyContent,
    }),
    margin,
    padding,
    overflow: 'auto',
  };

  if (heightConfig === 'auto') {
    style.height = 'auto';
  } else {
    style.height = height ?? 200;
  }

  return (
    <div ref={ref} style={style} {...rest}>
      {display === 'grid' && layoutMode !== 'absolute' ? (
        <MaterialGrid columns={gridColumns} placeholder={om_dropPlaceholder}>
          {children}
        </MaterialGrid>
      ) : (
        (children ?? om_dropPlaceholder)
      )}
    </div>
  );
};

Container.displayName = 'Container';

export default Container;
