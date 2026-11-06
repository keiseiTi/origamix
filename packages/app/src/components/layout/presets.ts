import type { EditorInstance } from '@origamix/editor';
import { reconcileAntdLayoutSchema } from '@origamix/materials/antd/layout/manifest';
import type { OrigamixPageSchema } from '@origamix/shared';
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
  const settings: Record<LayoutPreset, Record<string, unknown>> = {
    blank: { variant: 'top', headerEnabled: false, siderEnabled: false, footerEnabled: false },
    top: { variant: 'top', headerEnabled: true, siderEnabled: false, footerEnabled: false },
    side: { variant: 'side', headerEnabled: false, siderEnabled: true, footerEnabled: false },
    'top-side': {
      variant: 'top-side',
      headerEnabled: true,
      siderEnabled: true,
      footerEnabled: false,
    },
    'side-top': {
      variant: 'side-top',
      headerEnabled: true,
      siderEnabled: true,
      footerEnabled: false,
    },
  };
  const root = previous.layout.root;
  return reconcileAntdLayoutSchema(
    {
      ...previous,
      elements: {
        ...previous.elements,
        [root]: {
          ...previous.elements[root]!,
          props: { ...previous.elements[root]!.props, ...settings[preset], brand: projectName },
        },
      },
    },
    previous,
  );
};
