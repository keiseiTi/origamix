import type { ComponentType, LazyExoticComponent, ReactNode } from 'react';
import type { MaterialManifest, MaterialLayout } from '@origamix/shared';

export interface AttributeConfig {
  /** Defaults to true for draft editors; live controls opt out to preserve input focus. */
  resetOnValueChange?: boolean;
  label?: ReactNode;
  field: string;
  uiType?: string;
  defaultValue?: string | number | boolean;
  required?: boolean;
  linkageShow?: { field: string; value?: string | number | boolean; isNotEmpty?: boolean }[];
  linkageMode?: 'any';
}
export interface PanelConfig {
  title?: ReactNode;
  configs?: AttributeConfig[];
}
export interface EditorConfig {
  panels?: PanelConfig[];
}
/** Minimal structural contract; concrete control configuration belongs to Materials. */
export interface Material {
  Component: ComponentType | LazyExoticComponent<ComponentType>;
  title: string;
  type: string;
  icon?: ReactNode;
  dropTypes?: string[];
  defaultProps?: Record<string, unknown>;
  acceptsChildren?: boolean;
  layout?: MaterialLayout;
  editorConfig?: EditorConfig;
  contextConfig?: {
    variables?: MaterialManifest['context']['variables'];
    actions?: MaterialManifest['context']['actions'];
    events?: {
      name: string;
      description?: string;
      params?: { description: string; fields?: Record<string, unknown> }[];
      linkageShow?: AttributeConfig['linkageShow'];
      linkageMode?: 'any';
    }[];
  };
}
