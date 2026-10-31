import { getContainerStyle, type ContainerLayoutProps } from '../container-layout';
import React from 'react';
import type { RuntimeMaterialProps as MaterialComponentProps } from '@';

export interface IProps extends MaterialComponentProps, ContainerLayoutProps {
  children?: React.ReactNode;
  margin?: number | string;
  padding?: number | string;
  heightConfig?: 'fixed' | 'auto';
  height?: number | string;
}

// Ref remains available to component consumers; Editor targets the shared layout frame.
export const Container = React.forwardRef<HTMLDivElement>((props: IProps, ref) => {
  const {
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
    display,
    flexDirection,
    gap,
    flexWrap,
    alignItems,
    justifyContent,
    ...rest
  } = props;

  const style: React.CSSProperties = {
    ...getContainerStyle({ display, flexDirection, gap, flexWrap, alignItems, justifyContent }),
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
      {children || om_dropPlaceholder}
    </div>
  );
});

Container.displayName = 'Container';

export default Container;
