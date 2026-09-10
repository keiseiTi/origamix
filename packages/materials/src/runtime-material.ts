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
