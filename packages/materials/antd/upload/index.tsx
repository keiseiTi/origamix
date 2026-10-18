import React from 'react';
import { Button, Upload as AntdUpload, type UploadProps } from 'antd';
import type { RuntimeMaterialProps } from '@';

export type IProps = UploadProps & RuntimeMaterialProps & { drag?: boolean; text?: string };
export const Upload = ({
  children,
  drag,
  text = '选择文件',
  disabled,
  action,
  beforeUpload,
  tg_setContextValues,
  ...rest
}: IProps) => {
  const uploadProps: UploadProps = {
    ...rest,
    disabled,
    action,
    beforeUpload: beforeUpload ?? (action ? undefined : () => false),
  };
  if (drag)
    return <AntdUpload.Dragger {...uploadProps}>{children ?? <p>{text}</p>}</AntdUpload.Dragger>;
  return (
    <AntdUpload {...uploadProps}>
      {children ?? <Button disabled={disabled}>{text}</Button>}
    </AntdUpload>
  );
};
export default Upload;
