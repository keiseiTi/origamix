import React from 'react';
import { Input as AntdInput } from 'antd';
import type { TextAreaProps } from 'antd/es/input/TextArea';
import type { RuntimeMaterialProps as MaterialComponentProps } from '@';

export type IProps = TextAreaProps &
  MaterialComponentProps & {
    minRows?: number;
    maxRows?: number;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  };

import { useRuntimeValue } from '../runtime-state';
export const Textarea = (props: IProps) => {
  const {
    onChange,
    onPressEnter,
    value,
    defaultValue,
    minRows,
    maxRows,
    autoSize,
    fieldName,
    fieldRequired,
    fieldLabel,
    tg_setRuntimeState,
    tg_setContextValues,
    ...rest
  } = props;
  const [current, change] = useRuntimeValue('value', value, defaultValue ?? '', tg_setRuntimeState);
  return (
    <AntdInput.TextArea
      {...rest}
      value={current}
      autoSize={
        autoSize
          ? {
              ...(typeof autoSize === 'object' ? autoSize : {}),
              ...(minRows !== undefined ? { minRows } : {}),
              ...(maxRows !== undefined ? { maxRows } : {}),
            }
          : false
      }
      onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
        change(event.target.value);
        onChange?.(event);
      }}
      onPressEnter={(event) => {
        change(event.currentTarget.value);
        if (!event.nativeEvent.isComposing) onPressEnter?.(event);
      }}
    />
  );
};
export default Textarea;
