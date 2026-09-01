import React from 'react';
import { Slider as AntdSlider, type SliderSingleProps } from 'antd';

export type IProps = SliderSingleProps & {};

export const Slider = (props: IProps) => {
  const { ...restProps } = props;
  return <AntdSlider {...restProps} />;
};

export default Slider;
