import type { EditorInstance } from '@origamix/editor';
import { PAGE_OUTLET_TYPE, PAGE_NAVIGATION_TYPE, type OrigamixPageSchema } from '@origamix/shared';
export const layoutPresets = [
  { id: 'blank', name: '空白' },
  { id: 'top', name: '顶部导航' },
  { id: 'side', name: '侧边导航' },
  { id: 'top-side', name: '顶部与侧边' },
  { id: 'side-top', name: '侧边与内容顶部' },
] as const;
export type LayoutPreset = (typeof layoutPresets)[number]['id'];
/** Presets are ordinary editable nodes. Retain the root identity and schema extensions. */
export const createLayoutPreset = (
  preset: LayoutPreset,
  previous: ReturnType<EditorInstance['getSchema']>,
  projectName: string,
): OrigamixPageSchema => {
  const root = previous.layout.root;
  const elements: OrigamixPageSchema['elements'] = {};
  const structure: OrigamixPageSchema['layout']['structure'] = {};
  const add = (type: string, props: Record<string, unknown>, parent: string): string => {
    const id = `layout_${crypto.randomUUID()}`;
    elements[id] = { type, props };
    (structure[parent] ??= []).push(id);
    return id;
  };
  const container = (parent: string, direction: string): string =>
    add(
      'container',
      { display: 'flex', flexDirection: direction, gap: 16, heightConfig: 'auto', layoutGrow: 1 },
      parent,
    );
  const title = (parent: string) => add('text', { text: projectName, type: 'h2' }, parent);
  const nav = (parent: string, horizontal: boolean) =>
    add(
      PAGE_NAVIGATION_TYPE,
      horizontal
        ? { direction: 'horizontal' }
        : { direction: 'vertical', layoutWidth: 'fixed', layoutFixedWidth: 224 },
      parent,
    );
  const outlet = (parent: string) =>
    add(PAGE_OUTLET_TYPE, { layoutWidth: 'fill', layoutGrow: 1 }, parent);
  elements[root] = {
    type: 'container',
    props: {
      display: 'flex',
      flexDirection: preset === 'side' || preset === 'side-top' ? 'row' : 'column',
      heightConfig: 'auto',
      padding: 24,
      gap: 16,
    },
  };
  if (preset === 'blank') outlet(root);
  else if (preset === 'top') {
    title(root);
    nav(root, true);
    outlet(root);
  } else if (preset === 'side') {
    nav(root, false);
    outlet(root);
  } else if (preset === 'top-side') {
    title(root);
    const row = container(root, 'row');
    nav(row, false);
    outlet(row);
  } else {
    nav(root, false);
    const column = container(root, 'column');
    title(column);
    outlet(column);
  }
  return {
    ...previous,
    elements,
    layout: { root, structure },
    flows: {},
    bindElements: [],
    context: { globalVariables: [] },
  };
};
