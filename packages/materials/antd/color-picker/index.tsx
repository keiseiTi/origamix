import React from 'react';
import {
  ColorPicker as AntdColorPicker,
  type ColorPickerProps as AntdColorPickerProps,
} from 'antd';
import type { Color } from 'antd/es/color-picker';

export interface ColorPickerProps extends Omit<AntdColorPickerProps, 'value' | 'onChange'> {
  value?: string | null;
  onChange?: (color: string) => void;
}

export const ColorPicker = (props: ColorPickerProps) => {
  const { value, onChange } = props;

  const _change = (color: Color) => {
    onChange?.(color.toHexString());
  };

  return <AntdColorPicker value={value} onChange={_change} />;
};
