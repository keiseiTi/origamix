import { getContainerStyle, type ContainerLayoutProps } from '../container-layout';
import React from 'react';
import type { RuntimeMaterialProps as MaterialComponentProps } from '@';
import { cn } from '@';

interface BasicPageProps extends MaterialComponentProps, ContainerLayoutProps {
  children?: React.ReactNode;
  margin?: number | string;
  padding?: number | string;
}

export const BasicPage = React.forwardRef<HTMLDivElement>((props: BasicPageProps, ref) => {
  const {
    children,
    margin,
    padding,
    om_dropPlaceholder,
    om_setContextValues,
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
    margin,
    padding,
    ...getContainerStyle({ display, flexDirection, gap, flexWrap, alignItems, justifyContent }),
    minHeight: '100%',
  };

  return (
    <div ref={ref} className={cn('overflow-auto w-full')} style={style} {...rest}>
      {children || om_dropPlaceholder}
    </div>
  );
});

export default BasicPage;
