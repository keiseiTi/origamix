import type React from 'react';
import type {
  Material as BasicMaterial,
  AttributeConfig as BasicAttributeConfig,
  PanelConfig as BasicPanelConfig,
  EditorConfig as BasicEditorConfig,
} from '@tangramino/base-editor';
import type {
  InputProps,
  SelectProps,
  CheckboxProps,
  SwitchProps,
  RadioProps,
  NumberFieldProps,
  ColorPickerProps,
} from '@heroui/react';

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
  props?: NumberFieldProps;
};

export type RadioAttributeConfig = BasicAttributeConfig & {
  uiType: 'radio';
  props?: Omit<RadioProps, 'value'> & {
    options?: OptionItem[];
    value?: string;
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
  props?: SelectProps<object> & {
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
