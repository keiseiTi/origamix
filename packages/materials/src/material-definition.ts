import { withCommonMaterialManifest } from './material-manifest';
import type { MaterialManifest } from '@origamix/shared';
import type { Material } from './material';

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

export const toMaterialManifest = (material: OrigamixMaterial): MaterialManifest =>
  withCommonMaterialManifest({
    type: material.type,
    title: material.title,
    defaultProps: material.defaultProps,
    context: material.context,
    ...material.metadata,
  });
