import type React from 'react';
import type { MaterialManifest, MaterialLayout, JsonSchema } from '@origamix/shared';

type BasicAttributeConfig = {
  /** Defaults to true for draft editors; live controls opt out to preserve input focus. */
  resetOnValueChange?: boolean;
  schema?: JsonSchema;
  hidden?: boolean;
  label?: React.ReactNode;
  field: string;
  uiType?: string;
  defaultValue?: string | number | boolean;
  required?: boolean;
  linkageShow?: { field: string; value?: string | number | boolean; isNotEmpty?: boolean }[];
};
type BasicPanelConfig = { title?: React.ReactNode };
type BasicEditorConfig = { panels?: PanelConfig[] };
type BasicMaterial = {
  Component: React.ComponentType | React.LazyExoticComponent<React.ComponentType>;
  title: string;
  type: string;
  icon?: React.ReactNode;
  dropTypes?: string[];
  defaultProps?: Record<string, unknown>;
  acceptsChildren?: boolean;
  layout?: MaterialLayout;
  contextConfig?: {
    variables?: MaterialManifest['context']['variables'];
    actions?: MaterialManifest['context']['actions'];
    events?: {
      name: string;
      description?: string;
      params?: { description: string; fields?: Record<string, unknown> }[];
    }[];
  };
};
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
  render: React.ComponentType<{
    value?: unknown;
    onChange?: (value: unknown) => void;
    elementProps?: Readonly<Record<string, unknown>>;
    fields?: readonly { name: string; label: string }[];
  }>;
};

/** Structured JSON editor; guards belong to editor metadata, never to the Manifest. */
export type JsonAttributeConfig = BasicAttributeConfig & {
  uiType: 'json';
  validateValue: (value: unknown) => string | undefined;
};

type AttributeControlConfig =
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

export type AttributeConfig = AttributeControlConfig & { linkageMode?: 'any' };

export type PanelConfig = BasicPanelConfig & {
  configs?: AttributeConfig[];
};

export type Material = BasicMaterial & {
  manifest: MaterialManifest;
  editorConfig?: BasicEditorConfig & {
    panels?: PanelConfig[];
  };
};
