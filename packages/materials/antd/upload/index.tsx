import React from 'react';
import { Button, Upload as AntdUpload, type UploadProps } from 'antd';
import { useState } from 'react';
import { fileDescriptions } from '../runtime-state';
import type { RuntimeMaterialProps } from '@';

export type IProps = UploadProps & RuntimeMaterialProps & { drag?: boolean; text?: string };
export const Upload = ({
  children,
  drag,
  text = '选择文件',
  disabled,
  action,
  beforeUpload,
  onChange,
  onRemove,
  fileList: _runtimeFiles,
  tg_setContextValues,
  tg_setRuntimeState,
  ...rest
}: IProps) => {
  const [files, setFiles] = useState<UploadProps['fileList']>([]);
  const uploadProps: UploadProps = {
    fileList: files,
    onChange: (info) => {
      setFiles(info.fileList);
      tg_setRuntimeState?.({ fileList: fileDescriptions(info.fileList) });
      onChange?.(info);
    },
    onRemove: (file) => {
      onRemove?.(file);
      return true;
    },
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
