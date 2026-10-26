import React from 'react';
import type { RuntimeMaterialProps as MaterialComponentProps } from '@';
import { cn } from '@';

interface BasicPageProps extends MaterialComponentProps {
  children?: React.ReactNode;
  margin?: number | string;
  padding?: number | string;
  display?: 'flow' | 'flex';
  flexDirection?: 'row' | 'column';
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
    ...rest
  } = props;

  const style: React.CSSProperties = {
    margin,
    padding,
    display: display === 'flex' ? 'flex' : undefined,
    height: '100%',
  };

  if (display === 'flex') {
    style.flexDirection = flexDirection;
  }

  return (
    <div ref={ref} className={cn('overflow-auto w-full')} style={style} {...rest}>
      {children || om_dropPlaceholder}
    </div>
  );
});

export default BasicPage;
