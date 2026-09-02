import React from 'react';
import type { MaterialComponentProps } from '@tangramino/base-editor';
import { cn } from '../../src/cn';

interface BasicPageProps extends MaterialComponentProps {
  children?: React.ReactNode;
  margin?: number | string;
  padding?: number | string;
  display?: 'stream' | 'flex';
  flexDirection?: 'row' | 'column';
}

export const BasicPage = React.forwardRef<HTMLDivElement>((props: BasicPageProps, ref) => {
  const {
    children,
    margin,
    padding,
    tg_dropPlaceholder,
    tg_setContextValues,
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
      {children || tg_dropPlaceholder}
    </div>
  );
});

export default BasicPage;
