export { OrigamixPage, findUnknownMaterialTypes } from './react';
export { DesignRenderer } from './design';
export type { OrigamixPageProps, RuntimeDiagnostic, RuntimeOutcome } from './react';
export type { DesignRendererProps, DesignElementProps } from './design';
export type { MaterialRegistry, RuntimeMaterialProps, RuntimeSchema } from './core/types';

export type { RuntimeDiagnosticsProps, ElementErrorPresentation } from './diagnostics';
export {
  OrigamixLayout,
  DesignLayoutRenderer,
  OrigamixApplicationPage,
  resolveApplicationLayout,
  useLayoutNavigation,
} from './layout';
export type {
  OrigamixLayoutProps,
  DesignLayoutRendererProps,
  OrigamixApplicationPageProps,
  LayoutNavigation,
} from './layout';

export { applicationPages } from '@origamix/shared';
export { ApplicationShell } from './application-shell';

export { ApplicationProvider, ApplicationAccess, useApplication } from './application';
export { createApplicationSession } from './application-session';
export type { ApplicationSession, ApplicationNavigation } from './application-session';
export { readApplicationDefinition } from '@origamix/shared';
