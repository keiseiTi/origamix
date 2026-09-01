import React from 'react';
import { Upload as AntdUpload, type UploadProps } from 'antd';

export type IProps = UploadProps & {
};

export const Upload = (props: IProps) => {
  const { children, ...restProps } = props;
  return (
    <AntdUpload
      {...restProps}
    >
      {children}
    </AntdUpload>
  );
};

export default Upload;
