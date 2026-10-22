import React from 'react';
import { FloatButton, type FloatButtonProps } from 'antd';

export type IProps = Pick<
  FloatButtonProps,
  'type' | 'shape' | 'disabled' | 'href' | 'target' | 'htmlType' | 'onClick'
>;
export const FloatButtonComponent = (props: IProps) => <FloatButton {...props} />;
export default FloatButtonComponent;
