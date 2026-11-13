import type { MaterialEventProps } from '../../src/runtime-material';
import { Button, Upload as AntdUpload, type UploadProps } from 'antd';
import { useLayoutEffect, useState } from 'react';
import type { RuntimeMaterialProps } from '@';

const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const fileDescriptions = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.map((file) => {
        const data = object(file);
        return Object.fromEntries(
          ['uid', 'name', 'status', 'percent', 'url', 'size', 'type']
            .filter((key) => data[key] !== undefined)
            .map((key) => [key, data[key]]),
        );
      })
    : [];

export type IProps = MaterialEventProps<UploadProps, 'onChange' | 'onRemove'> &
  RuntimeMaterialProps & { drag?: boolean; text?: string };
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
  om_setContextActions,
  om_setRuntimeState,
  om_mode,
  om_readonly,
  om_dropPlaceholder,
  ...rest
}: IProps) => {
  const [files, setFiles] = useState<UploadProps['fileList']>([]);
  useLayoutEffect(() => {
    om_setRuntimeState?.({ fileList: [] });
  }, [om_setRuntimeState]);
  const uploadProps: UploadProps = {
    fileList: files,
    onChange: (info) => {
      setFiles(info.fileList);
      om_setRuntimeState?.({ fileList: fileDescriptions(info.fileList) });
      onChange?.({
        file: fileDescriptions([info.file])[0],
        fileList: fileDescriptions(info.fileList),
      });
    },
    onRemove: (file) => {
      onRemove?.({ file: fileDescriptions([file])[0] });
      return true;
    },
    ...rest,
    disabled: disabled || om_mode === 'design',
    action: om_mode === 'design' ? undefined : action,
    beforeUpload:
      om_mode === 'design' ? () => false : (beforeUpload ?? (action ? undefined : () => false)),
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
