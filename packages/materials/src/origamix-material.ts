import type { Material } from './material';
import type { MaterialManifest } from './material-manifest';

type ManifestMetadata = Omit<MaterialManifest, 'type' | 'title' | 'defaultProps' | 'context'>;

export type OrigamixMaterial = Omit<
  Material,
  'Component' | 'title' | 'type' | 'defaultProps' | 'dropTypes' | 'contextConfig'
> & {
  type: string;
  title: string;
  defaultProps: Readonly<Record<string, unknown>>;
  context: MaterialManifest['context'];
  metadata: ManifestMetadata;
};

export const defineOrigamixMaterial = <T extends OrigamixMaterial>(material: T): T => material;

export const fromMaterialManifest = (
  manifest: MaterialManifest,
  editor: Pick<OrigamixMaterial, 'editorConfig' | 'isContainer'> = {},
): OrigamixMaterial => {
  const { type, title, defaultProps, context, ...metadata } = manifest;
  return defineOrigamixMaterial({ type, title, defaultProps, context, metadata, ...editor });
};

export const toMaterialManifest = (material: OrigamixMaterial): MaterialManifest => ({
  type: material.type,
  title: material.title,
  defaultProps: material.defaultProps,
  context: material.context,
  ...material.metadata,
});

const editorMaterials = new WeakSet<object>();

export const toEditorMaterial = (
  material: OrigamixMaterial,
  Component: Material['Component'],
): Material => {
  const editorMaterial: Material = {
    Component,
    title: material.title,
    type: material.type,
    defaultProps: material.defaultProps,
    ...(material.metadata.allowedParentTypes
      ? { dropTypes: [...material.metadata.allowedParentTypes] }
      : {}),
    contextConfig: {
      variables: [...material.context.variables],
      contextValues: [...material.context.values],
      methods: material.context.methods.map((method) => ({
        ...method,
        params: method.params?.map((param) => ({ description: param.description ?? '' })),
      })),
    },
    editorConfig: material.editorConfig,
    isContainer: material.isContainer,
  };
  editorMaterials.add(editorMaterial);
  return editorMaterial;
};

export const isOrigamixEditorMaterial = (material: Material): boolean =>
  editorMaterials.has(material);

export const fromLegacyEditorMaterial = (
  manifest: MaterialManifest,
  material: Material,
): Material =>
  toEditorMaterial(
    fromMaterialManifest(manifest, {
      editorConfig: material.editorConfig,
      isContainer: material.isContainer,
    }),
    material.Component,
  );
