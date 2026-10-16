import { withRuntimeMaterialProps } from './runtime-material';
import type { Material, PanelConfig, InputAttributeConfig, AttributeConfig } from './material';
import { toMaterialManifest, type OrigamixMaterial } from './material-definition';
export {
  defineOrigamixMaterial,
  fromMaterialManifest,
  toMaterialManifest,
  type OrigamixMaterial,
} from './material-definition';
export type { JsonAttributeConfig } from './material';

const editorMaterials = new WeakSet<object>();

export const toEditorMaterial = (
  material: OrigamixMaterial,
  Component: Material['Component'],
): Material => {
  const manifest = toMaterialManifest(material);
  const panels = (material.editorConfig?.panels ?? []) as PanelConfig[];
  const aliasConfig: InputAttributeConfig = {
    label: '别名',
    field: 'alias',
    uiType: 'input',
    required: false,
  };
  const editorMaterial: Material = {
    Component: withRuntimeMaterialProps(Component),
    title: material.title,
    type: material.type,
    defaultProps: material.defaultProps,
    ...(material.metadata.allowedParentTypes
      ? { dropTypes: [...material.metadata.allowedParentTypes] }
      : {}),
    contextConfig: {
      variables: [...material.context.variables],
      contextValues: [...material.context.values],
      methods: manifest.context.methods.map((method) => ({
        ...method,
        params: method.params?.map((param) => ({ description: param.description ?? '' })),
      })),
    },
    editorConfig: {
      ...material.editorConfig,
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
    isContainer: material.isContainer,
  };
  editorMaterials.add(editorMaterial);
  return editorMaterial;
};

export const isOrigamixEditorMaterial = (material: Material): boolean =>
  editorMaterials.has(material);
