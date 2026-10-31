import type { OrigamixPageSchema } from '@origamix/shared';
import type { ComponentType, LazyExoticComponent, ReactNode } from 'react';

/** Accept JSON module inference; the rendering boundary checks the release tag. */
export type RuntimeSchema = Omit<OrigamixPageSchema, 'extensions'> & {
  extensions: Record<string, unknown>;
};
export type RuntimeMaterialProps = {
  'data-element-id'?: string;
  om_readonly?: boolean;
  om_mode?: 'design' | 'render';
  om_dropPlaceholder?: ReactNode;
  om_designOpen?: boolean;
  om_designLayer?: number;
  om_onDesignClose?: () => void;
  om_renderDesignFrame?: (content: ReactNode) => ReactNode;
  om_setRuntimeState?: (state: Record<string, unknown>) => void;
  om_setContextActions?: (values: Record<string, unknown>) => void;
  [key: string]: unknown;
};
export type MaterialRegistry = Record<string, ComponentType | LazyExoticComponent<ComponentType>>;
export type LayoutNode = { id: string; children: LayoutNode[] };
export type RuntimeElementState = {
  type: string;
  props: Record<string, unknown>;
  hidden?: boolean;
};
export type Listener = (...args: unknown[]) => unknown;
export interface RuntimeEngine {
  elements: Record<string, RuntimeElementState>;
  layouts: LayoutNode[];
  injectionCallback: Record<string, Record<string, Listener[]>>;
  disposed: boolean;
  signal: AbortSignal;
  activate: () => void;
  dispose: () => void;
  subscribe: (event: string, listener: Listener) => () => void;
  setState: (state: Record<string, Record<string, unknown>>) => void;
  getState: (id?: string) => Record<string, unknown> | null;
  showElements: (ids: string[]) => void;
  hiddenElements: (ids: string[]) => void;
  setContextValue: (id: string, value: Record<string, unknown>) => void;
  getContextValue: (id: string) => Record<string, unknown> | undefined;
  setGlobalVariable: (name: string, value: unknown) => void;
  getGlobalVariable: (name: string) => unknown;
  injectCallback: (id: string, name: string, callback: Listener) => void;
}
export interface FlowExecuteContext<T> {
  data: T;
  engine: RuntimeEngine;
  lastReturnedVal?: Record<string, unknown>;
  signal?: AbortSignal;
}
export type LogicNodes = Record<
  string,
  (context: FlowExecuteContext<Record<string, unknown>>) => unknown
>;
