import React from 'react';
import { Tabs as AntdTabs, type TabsProps } from 'antd';

export type IProps = TabsProps & {
};

export const Tabs = (props: IProps) => {
  const { ...restProps } = props;
  return (
    <AntdTabs
      {...restProps}
    />
  );
};

export default Tabs;
