import type { ReactNode } from 'react';
import type { MaterialManifest, OrigamixPageSchema } from '@origamix/shared';
import type { Material, PanelConfig } from './material-interfaces';
import type { EditorInstance } from './editor-instance-interfaces';

export type EditorToolbarArea = 'all' | 'start' | 'center' | 'end';
export type EditorPluginRenderContext<Props = undefined> = Readonly<{
  props: Props;
  editor: EditorInstance;
  children: ReactNode;
}>;
/** Read-only snapshots; material identity and component registration stay with the host. */
export type EditorPluginMaterialContext = Readonly<{
  material: Readonly<Material>;
  manifest: MaterialManifest;
}>;
export type EditorPluginMaterialNodeContext = EditorPluginMaterialContext &
  Readonly<{
    editor: EditorInstance;
    elementId: string;
    element: Readonly<OrigamixPageSchema['elements'][string]>;
    /** Nearest parent first. */
    ancestors: readonly Readonly<{
      elementId: string;
      element: Readonly<OrigamixPageSchema['elements'][string]>;
      material: Readonly<Material>;
    }>[];
  }>;
export type EditorPluginMaterialExtension = Readonly<{
  defaultProps?: Readonly<Record<string, unknown>>;
  panels?: readonly PanelConfig[];
}>;
export type EditorPluginMaterialApi = Readonly<{
  /** Additive editor configuration. New persisted fields require a matching published Manifest. */
  extend?: (context: EditorPluginMaterialContext) => EditorPluginMaterialExtension | void;
  /** Receives the panels already composed to the right; return [...panels, extra] to append. */
  getPanels?: (
    context: EditorPluginMaterialNodeContext & Readonly<{ panels: readonly PanelConfig[] }>,
  ) => readonly PanelConfig[];
  /** Design-only material content, inside the kernel-owned selection and drag frame. */
  render?: (
    context: EditorPluginMaterialNodeContext & Readonly<{ children: ReactNode }>,
  ) => ReactNode;
}>;
export type EditorPlugin<Props = undefined> = Readonly<{
  id: string;
  setup?: (
    context: Readonly<{ editor: EditorInstance; signal: AbortSignal }>,
  ) => void | (() => void);
  material?: EditorPluginMaterialApi;
  editor?: Readonly<{
    renderToolbar?: (
      context: EditorPluginRenderContext<Props> & Readonly<{ area: EditorToolbarArea }>,
    ) => ReactNode;
    renderTop?: (context: EditorPluginRenderContext<Props>) => ReactNode;
    renderBottom?: (context: EditorPluginRenderContext<Props>) => ReactNode;
  }>;
}>;

/** A definition stays fixed; withProps binds the latest render inputs. */
export type EditorPluginDefinition<Props> = EditorPlugin<Props> &
  Readonly<{
    withProps: (props: Props) => EditorPlugin;
  }>;
