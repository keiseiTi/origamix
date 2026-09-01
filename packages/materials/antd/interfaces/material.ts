import type React from 'react';
import type {
  Material as BasicMaterial,
  AttributeConfig as BasicAttributeConfig,
  PanelConfig as BasicPanelConfig,
  EditorConfig as BasicEditorConfig,
} from '@tangramino/base-editor';
import type {
  InputProps,
  InputNumberProps,
  SelectProps,
  CheckboxProps,
  SwitchProps,
  RadioProps,
} from 'antd';
import type { ColorPickerProps } from '../components/color-picker';

export type OptionItem = {
  label: string;
  value: string | undefined | boolean;
};

export type TextAttributeConfig = BasicAttributeConfig & {
  uiType: 'text';
};

export type InputAttributeConfig = BasicAttributeConfig & {
  uiType: 'input';
  props?: InputProps;
};

export type NumberAttributeConfig = BasicAttributeConfig & {
  uiType: 'number';
  props?: InputNumberProps;
};

export type RadioAttributeConfig = BasicAttributeConfig & {
  uiType: 'radio';
  props?: RadioProps & {
    options?: OptionItem[];
  };
};

export type CheckboxAttributeConfig = BasicAttributeConfig & {
  uiType: 'checkbox';
  props?: CheckboxProps & {
    options?: OptionItem[];
  };
};

export type SelectAttributeConfig = BasicAttributeConfig & {
  uiType: 'select';
  props?: SelectProps & {
    options?: OptionItem[];
  };
};

export type SwitchAttributeConfig = BasicAttributeConfig & {
  uiType: 'switch';
  props?: SwitchProps;
};

export type ColorAttributeConfig = BasicAttributeConfig & {
  uiType: 'color';
  props?: ColorPickerProps;
};

export type CustomAttributeConfig = BasicAttributeConfig & {
  uiType: 'custom';
  render: (props: BasicAttributeConfig) => React.ReactNode;
};

export type AttributeConfig =
  | TextAttributeConfig
  | InputAttributeConfig
  | NumberAttributeConfig
  | RadioAttributeConfig
  | CheckboxAttributeConfig
  | SelectAttributeConfig
  | SwitchAttributeConfig
  | ColorAttributeConfig
  | CustomAttributeConfig;

export type PanelConfig = BasicPanelConfig & {
  configs?: AttributeConfig[];
};

export type Material = BasicMaterial & {
  editorConfig?: BasicEditorConfig & {
    panels?: PanelConfig[];
  };
};
