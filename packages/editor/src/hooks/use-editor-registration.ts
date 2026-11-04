import { useMemo } from 'react';
import { snapshotEditorPlugins } from '../plugins/plugin-host';
import { extendEditorMaterial } from '../plugins/material-plugins';
import { getEditorPlugins } from '../session/editor-instance';
import type { EditorInstance } from '../interfaces/editor-instance-interfaces';
import type { EditorMaterialRegistration } from '../interfaces/editor-interfaces';
export const useEditorRegistration = (
  editor: EditorInstance,
  registration: EditorMaterialRegistration,
) => {
  const plugins = useMemo(
    () => snapshotEditorPlugins([...getEditorPlugins(editor), ...(registration.plugins ?? [])]),
    [editor, registration],
  );
  const extendedMaterials = useMemo(() => {
    const registry = new Map(
      registration.catalog.materials.map((manifest) => [manifest.type, manifest]),
    );
    return new Map(
      [
        ...(registration.rootMaterials ?? []),
        ...registration.groups.flatMap((group) => group.children),
      ].map((material) => {
        const manifest = registry.get(material.type);
        if (!manifest) throw new Error(`物料 ${material.type} 缺少 Manifest`);
        return [material.type, extendEditorMaterial(material, manifest, plugins)];
      }),
    );
  }, [registration, plugins]);
  const groups = useMemo(
    () =>
      registration.groups.map((group) => ({
        title: group.title,
        children: group.children.map((material) => extendedMaterials.get(material.type)!),
      })),
    [registration, extendedMaterials],
  );
  const rootMaterialTypes = useMemo(
    () => (registration.rootMaterials ?? []).map((material) => material.type),
    [registration.rootMaterials],
  );
  const materials = useMemo(
    () => [
      ...(registration.rootMaterials ?? []).map((material) =>
        extendedMaterials.get(material.type)!,
      ),
      ...groups.flatMap((group) => group.children),
    ],
    [groups, registration.rootMaterials, extendedMaterials],
  );

  return { plugins, groups, rootMaterialTypes, materials };
};
