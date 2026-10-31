import { layoutPanel } from './layout-panel';
import type { Material, PanelConfig, InputAttributeConfig, AttributeConfig } from './material';
import type { MaterialManifest } from '@origamix/shared';
import { createMaterialManifest } from './material-definition';

export type MaterialDefinition = Pick<Material, 'Component' | 'editorConfig'> &
  Omit<MaterialManifest, 'version' | 'propsSchema' | 'defaultProps'> & {
    defaultProps?: MaterialManifest['defaultProps'];
  };

const editorMaterials = new WeakSet<object>();

/** Assemble editor metadata from a Manifest, including context mapping and the alias control. */
export const defineMaterial = ({
  Component,
  editorConfig,
  ...metadata
}: MaterialDefinition): Material => {
  const manifest = createMaterialManifest({ ...metadata, Component, editorConfig });
  const panels = [...(editorConfig?.panels ?? []), layoutPanel].map((panel) => ({
    ...panel,
    configs: panel.configs?.filter((config) => !config.hidden),
  })) as PanelConfig[];
  const aliasConfig: InputAttributeConfig = {
    label: '别名',
    field: 'alias',
    uiType: 'input',
    required: false,
  };
  const editorMaterial: Material = {
    manifest,
    Component: Object.assign(Component, { origamixLayout: manifest.layout }),
    title: manifest.title,
    type: manifest.type,
    defaultProps: manifest.defaultProps,
    ...(manifest.allowedParentTypes ? { dropTypes: [...manifest.allowedParentTypes] } : {}),
    contextConfig: {
      variables: [...manifest.context.variables],
      actions: [...manifest.context.actions],
      events: manifest.context.events.map((event) => ({
        ...event,
        params: event.params?.map((param) => ({ description: param.description ?? '' })),
      })),
    },
    acceptsChildren: manifest.acceptsChildren,
    layout: manifest.layout,
    editorConfig: {
      ...editorConfig,
      panels: panels.some((panel) => panel.title === '属性')
        ? panels.map((panel) =>
            panel.title === '属性'
              ? {
                  ...panel,
                  configs: [
                    aliasConfig,
                    ...(manifest.propsSchema.properties &&
                    'fieldName' in (manifest.propsSchema.properties as Record<string, unknown>)
                      ? ([
                          { field: 'fieldName', label: '表单字段名', uiType: 'input' },
                          {
                            field: 'fieldRequired',
                            label: '必填字段',
                            uiType: 'checkbox',
                            linkageShow: [{ field: 'fieldName', isNotEmpty: true }],
                          },
                          {
                            field: 'fieldLabel',
                            label: '字段标签',
                            uiType: 'input',
                            linkageShow: [{ field: 'fieldName', isNotEmpty: true }],
                          },
                        ] as AttributeConfig[])
                      : []),
                    ...((panel.configs as AttributeConfig[] | undefined) ?? []).filter(
                      (config) => config.field !== 'alias',
                    ),
                  ],
                }
              : panel,
          )
        : [{ title: '属性', configs: [aliasConfig] }, ...panels],
    },
  };
  editorMaterials.add(editorMaterial);
  return editorMaterial;
};

export const isOrigamixEditorMaterial = (material: Material): boolean =>
  editorMaterials.has(material);
