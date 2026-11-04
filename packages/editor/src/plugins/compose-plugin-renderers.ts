import type { ReactNode } from 'react';
import type { EditorPlugin, EditorToolbarArea } from '../interfaces/plugin-interfaces';
import type { EditorInstance } from '../interfaces/editor-instance-interfaces';

/** Each callback receives the content already composed by plugins to its right. */
export const composePluginRenderers = (
  plugins: readonly EditorPlugin[],
  editor: EditorInstance,
  target: 'renderTop' | 'renderBottom' | 'renderToolbar',
  children: ReactNode,
  area: EditorToolbarArea = 'all',
): ReactNode =>
  plugins.reduceRight<ReactNode>((content, plugin) => {
    const render = plugin.editor?.[target];
    return render ? render({ editor, children: content, area }) : content;
  }, children);
