import React from 'react';
import type { MaterialComponentProps } from '@tangramino/base-editor';

export interface IProps extends MaterialComponentProps {
  children?: React.ReactNode;
  margin?: number | string;
  padding?: number | string;
  heightConfig?: 'fixed' | 'auto';
  height?: number | string;
}

// 容器组件必须使用 React.forwardRef 以支持拖放功能
export const Container = React.forwardRef<HTMLDivElement>((props: IProps, ref) => {
  const {
    children,
    margin,
    padding,
    heightConfig,
    height,
    tg_dropPlaceholder,
    tg_setContextValues,
    ...rest
  } = props;

  const style: React.CSSProperties = {
    margin,
    padding,
    overflow: 'auto',
  };

  if (heightConfig === 'auto') {
    style.flex = 1;
  } else {
    style.height = height || 200;
  }

  return (
    <div ref={ref} style={style} {...rest}>
      {children || tg_dropPlaceholder}
    </div>
  );
});

Container.displayName = 'Container';

export default Container;
