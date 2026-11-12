import { resolveMaterialPanels } from '../../plugins/material-plugins';
import { useEditorContext } from '../../hooks/use-editor-context';
import { editorSnapshot } from '../../session/editor-snapshots';
import type { EventFocusProps } from '../editor-layout/event-focus-target';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMaterialCatalog } from '../../session/editor-environment';
import { SchemaUtils } from '../../schema/schema-utils';
import { useEditorCore } from '../../session/editor-context';
import { type ActiveElement } from '../../session/editor-store';
import type { AttributeConfig, Material } from '../../interfaces/material';
import { isVisible } from './attribute-rules';

export const useAttributePanel = (focusTarget: EventFocusProps['focusTarget']) => {
  const { activeElement, materials, schema, plugins, setActiveElement, setSchema } = useEditorCore(
    useShallow((state) => ({
      activeElement: state.activeElement,
      materials: state.materials,
      schema: state.schema,
      plugins: state.plugins,
      setActiveElement: state.setActiveElement,
      setSchema: state.setSchema,
    })),
  );
  const editor = useEditorContext();
  const [activePanel, setActivePanel] = useState(focusTarget ? 'events' : '0');
  const previousElementId = useRef(activeElement?.id);
  const material = activeElement?.material;
  const catalog = useMaterialCatalog();
  const element = activeElement ? schema.elements[activeElement.id] : undefined;
  const values = element?.props ?? {};
  const propsSchema = catalog.find((item) => item.type === element?.type)?.propsSchema;
  const declared = propsSchema?.properties as Record<string, unknown> | undefined;
  const obsoleteFields =
    propsSchema?.additionalProperties === false && !propsSchema.patternProperties && declared
      ? Object.keys(values).filter((field) => !Object.hasOwn(declared, field))
      : [];

  const parentTabsId = activeElement
    ? SchemaUtils.getParents(schema, activeElement.id).find(
        (id) => schema.elements[id]?.type === 'tabs',
      )
    : undefined;
  const tabItems =
    parentTabsId && Array.isArray(schema.elements[parentTabsId]?.props?.items)
      ? (schema.elements[parentTabsId]!.props.items as { key: string; label: string }[])
      : [];
  const allEvents = material?.contextConfig?.events;
  const events = allEvents?.filter((event) =>
    isVisible(event as unknown as AttributeConfig, { ...material?.defaultProps, ...values }),
  );
  const hiddenBindings = allEvents?.filter(
    (event) =>
      !events?.includes(event) &&
      schema.bindElements?.some(
        (binding) => binding.id === activeElement?.id && binding.event === event.name,
      ),
  );
  const manifest = catalog.find((item) => item.type === material?.type);
  const materialPanels =
    activeElement && element && material && manifest
      ? resolveMaterialPanels(
          {
            editor,
            material: editorSnapshot(material) as Material,
            manifest,
            elementId: activeElement.id,
            element: editorSnapshot(element),
            ancestors: SchemaUtils.getParents(schema, activeElement.id).flatMap((elementId) => {
              const ancestor = schema.elements[elementId];
              const ancestorMaterial = materials.find((item) => item.type === ancestor?.type);
              return ancestor && ancestorMaterial
                ? [
                    {
                      elementId,
                      element: editorSnapshot(ancestor),
                      material: editorSnapshot(ancestorMaterial) as Material,
                    },
                  ]
                : [];
            }),
          },
          plugins ?? [],
        )
      : (material?.editorConfig?.panels ?? []);
  const panels = [
    ...materialPanels.map((panel) => ({
      ...panel,
      configs: [
        ...(panel.configs ?? []),
        ...(panel.title === '属性' && parentTabsId
          ? [
              {
                field: 'tabKey',
                required: false,
                label: '所属页签',
                uiType: 'select',
                props: {
                  options: tabItems.map((item) => ({ label: item.label, value: item.key })),
                },
              },
            ]
          : []),
      ],
      kind: 'attributes' as const,
    })),
    ...(events?.length ? [{ title: '事件', kind: 'events' as const, events }] : []),
  ];

  useEffect(() => {
    if (previousElementId.current === activeElement?.id) return;
    previousElementId.current = activeElement?.id;
    setActivePanel('0');
  }, [activeElement?.id]);

  const parents = useMemo<ActiveElement[]>(() => {
    if (!activeElement) return [];
    return SchemaUtils.getParents(schema, activeElement.id)
      .reverse()
      .map((id) => {
        const parent = schema.elements[id];
        const parentMaterial = parent
          ? materials.find((item) => item.type === parent.type)
          : undefined;
        return parent && parentMaterial
          ? ({
              id,
              type: parent.type,
              props: parent.props ?? {},
              material: parentMaterial,
            } as ActiveElement)
          : null;
      })
      .filter((item): item is ActiveElement => item !== null);
  }, [activeElement, materials, schema]);

  const update = (field: string, value: unknown): void => {
    if (!activeElement) return;
    const result = SchemaUtils.setElementProps(schema, activeElement.id, { [field]: value });
    setSchema(result.schema, { historyGroup: `props:${activeElement.id}:${field}` });
  };

  const removeObsoleteFields = (): void => {
    if (!element || !activeElement) return;
    const props = Object.fromEntries(
      Object.entries(values).filter(([field]) => !obsoleteFields.includes(field)),
    );
    setSchema({
      ...schema,
      elements: { ...schema.elements, [activeElement.id]: { ...element, props } },
    });
  };
  return {
    activeElement,
    schema,
    material,
    values,
    obsoleteFields,
    hiddenBindings,
    panels,
    parents,
    activePanel,
    setActivePanel,
    setActiveElement,
    update,
    removeObsoleteFields,
  };
};
