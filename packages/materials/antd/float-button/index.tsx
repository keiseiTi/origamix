import React from 'react';
import { FloatButton, type FloatButtonProps } from 'antd';

export type IProps = FloatButtonProps & {
  backgroundColor?: string;
  color?: string;
  borderColor?: string;
  borderRadius?: number | string;
};

export const FloatButtonComponent = (props: IProps) => {
  const {
    backgroundColor,
    color,
    borderColor,
    borderRadius,
    ...restProps
  } = props;

  const customStyle = {
    backgroundColor,
    color,
    borderColor,
    borderRadius,
  };

  return (
    <FloatButton
      style={customStyle}
      {...restProps}
    />
  );
};

export default FloatButtonComponent;
