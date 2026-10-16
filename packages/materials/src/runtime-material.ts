import { createElement, type ComponentType } from 'react';
import type { ReactNode } from 'react';

/** Props injected by Tangramino while rendering, independent of editor configuration APIs. */
export interface RuntimeMaterialProps {
  'data-element-id'?: string;
  tg_readonly?: boolean;
  tg_mode?: 'design' | 'render';
  tg_dropPlaceholder?: ReactNode;
  tg_setContextValues?: (contextValues: Record<string, unknown>) => void;
  [key: string]: unknown;
}

/** Strip editor metadata at rendering boundaries without changing the retained Schema. */
export const withRuntimeMaterialProps = <P extends object>(
  Component: ComponentType<P>,
): ComponentType<P> => {
  const RuntimeMaterial = (props: P) => {
    const { alias: _alias, ...runtimeProps } = props as P & { alias?: unknown };
    return createElement(Component, runtimeProps as P);
  };
  return RuntimeMaterial;
};
