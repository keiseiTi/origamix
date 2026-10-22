import type React from 'react';
import type {
  Material as BasicMaterial,
  AttributeConfig as BasicAttributeConfig,
  PanelConfig as BasicPanelConfig,
  EditorConfig as BasicEditorConfig,
} from '@tangramino/base-editor';
import type { Input, Select, Checkbox, Switch, RadioGroupItem } from '@origamix/ui';

export type OptionItem = {
  label: string;
  value: string | undefined | boolean;
};

export type TextAttributeConfig = BasicAttributeConfig & {
  uiType: 'text';
};

export type InputAttributeConfig = BasicAttributeConfig & {
  uiType: 'input';
  props?: React.ComponentProps<typeof Input>;
};

export type NumberAttributeConfig = BasicAttributeConfig & {
  uiType: 'number';
  props?: React.ComponentProps<typeof Input>;
};

export type RadioAttributeConfig = BasicAttributeConfig & {
  uiType: 'radio';
  props?: Omit<React.ComponentProps<typeof RadioGroupItem>, 'value'> & {
    options?: OptionItem[];
    value?: string;
  };
};

export type CheckboxAttributeConfig = BasicAttributeConfig & {
  uiType: 'checkbox';
  props?: React.ComponentProps<typeof Checkbox> & {
    options?: OptionItem[];
  };
};

export type SelectAttributeConfig = BasicAttributeConfig & {
  uiType: 'select';
  props?: React.ComponentProps<typeof Select> & {
    options?: OptionItem[];
  };
};

export type SwitchAttributeConfig = BasicAttributeConfig & {
  uiType: 'switch';
  props?: React.ComponentProps<typeof Switch>;
};

export type ColorAttributeConfig = BasicAttributeConfig & {
  uiType: 'color';
  props?: React.ComponentProps<typeof Input>;
};

export type CustomAttributeConfig = BasicAttributeConfig & {
  uiType: 'custom';
  render: React.ComponentType<{ value?: unknown; onChange?: (value: unknown) => void }>;
};

/** Structured JSON editor; guards belong to editor metadata, never to the Manifest. */
export type JsonAttributeConfig = BasicAttributeConfig & {
  uiType: 'json';
  validateValue: (value: unknown) => string | undefined;
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
  | JsonAttributeConfig
  | CustomAttributeConfig;

export type PanelConfig = BasicPanelConfig & {
  configs?: AttributeConfig[];
};

export type Material = BasicMaterial & {
  editorConfig?: BasicEditorConfig & {
    panels?: PanelConfig[];
  };
};
