import type { Material, PanelConfig, InputAttributeConfig, AttributeConfig } from './material';
import type { MaterialManifest } from '@origamix/shared';
import { withCommonMaterialManifest } from './material-manifest';

export type MaterialDefinition = Pick<Material, 'Component' | 'editorConfig' | 'isContainer'> & {
  manifest: MaterialManifest;
};

const editorMaterials = new WeakSet<object>();

/** Assemble editor metadata from a Manifest, including context mapping and the alias control. */
export const defineMaterial = ({
  manifest: inputManifest,
  Component,
  editorConfig,
  isContainer,
}: MaterialDefinition): Material => {
  const manifest = withCommonMaterialManifest(inputManifest);
  const panels = (editorConfig?.panels ?? []) as PanelConfig[];
  const aliasConfig: InputAttributeConfig = {
    label: '别名',
    field: 'alias',
    uiType: 'input',
    required: false,
  };
  const editorMaterial: Material = {
    Component,
    title: manifest.title,
    type: manifest.type,
    defaultProps: manifest.defaultProps,
    ...(manifest.allowedParentTypes ? { dropTypes: [...manifest.allowedParentTypes] } : {}),
    contextConfig: {
      variables: [...manifest.context.variables],
      contextValues: [...manifest.context.values],
      methods: manifest.context.methods.map((method) => ({
        ...method,
        params: method.params?.map((param) => ({ description: param.description ?? '' })),
      })),
    },
    editorConfig: {
      ...editorConfig,
      panels: panels.some((panel) => panel.title === '属性')
        ? panels.map((panel) =>
            panel.title === '属性'
              ? {
                  ...panel,
                  configs: [
                    aliasConfig,
                    ...((panel.configs as AttributeConfig[] | undefined) ?? []).filter(
                      (config) => config.field !== 'alias',
                    ),
                  ],
                }
              : panel,
          )
        : [{ title: '属性', configs: [aliasConfig] }, ...panels],
    },
    isContainer,
  };
  editorMaterials.add(editorMaterial);
  return editorMaterial;
};

export const isOrigamixEditorMaterial = (material: Material): boolean =>
  editorMaterials.has(material);
