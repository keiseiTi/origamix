import { useMemo, type ReactNode, type MouseEvent } from 'react';
import { DesignRenderer, type DesignElementProps } from '@origamix/runtime';
import { useDroppable } from '@dnd-kit/core';
import type { Material } from '../contracts/material-contracts';
import { useEditorCore } from '../session/editor-session';
import { SchemaUtils } from '../schema/schema-utils';
import { SelectionOverlay } from './selection-overlay';

export interface DropPlaceholderProps {
  isDragOver: boolean;
  material: Material;
}
export interface EnhancedComponentProps {
  children: React.JSX.Element;
  elementProps: Record<string, unknown>;
  material: Material;
}
interface CanvasProps {
  className?: string;
  renderDropIndicator?: (props: DropPlaceholderProps) => ReactNode;
  renderElement?: (props: EnhancedComponentProps) => ReactNode;
  renderOverlayContent?: () => ReactNode;
}
export const CanvasEditor = ({
  className,
  renderDropIndicator,
  renderElement,
  renderOverlayContent,
}: CanvasProps): React.JSX.Element => {
  const schema = useEditorCore((state) => state.schema);
  const materials = useEditorCore((state) => state.materials);
  const setCanvasRoot = useEditorCore((state) => state.setCanvasRoot);
  const components = useMemo(
    () => Object.fromEntries(materials.map((material) => [material.type, material.Component])),
    [materials],
  );
  return (
    <div
      ref={setCanvasRoot}
      className={className}
      data-editor-canvas='true'
      onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest('a,button[type="submit"]'))
          event.preventDefault();
      }}
    >
      <DesignRenderer
        schema={schema}
        materials={components}
        renderElement={(element) => (
          <EditableMaterial
            key={element.id}
            element={element}
            renderDropIndicator={renderDropIndicator}
            renderElement={renderElement}
          />
        )}
      />
      <SelectionOverlay renderContent={renderOverlayContent} />
    </div>
  );
};
const EditableMaterial = ({
  element,
  renderDropIndicator,
  renderElement,
}: { element: DesignElementProps } & Pick<
  CanvasProps,
  'renderDropIndicator' | 'renderElement'
>): ReactNode => {
  const { schema, materials, setActiveElement } = useEditorCore();
  const material = materials.find((item) => item.type === element.type);
  if (!material) throw new Error(`未知物料：${element.type}`);
  const content = (
    <ElementWrapper
      element={element}
      material={material}
      select={(event) => {
        event.stopPropagation();
        const parents = SchemaUtils.getParents(schema, element.id).flatMap((id) => {
          const parent = schema.elements[id]!;
          const registration = materials.find((item) => item.type === parent.type);
          return registration ? [{ id, ...parent, material: registration }] : [];
        });
        setActiveElement({
          id: element.id,
          type: element.type,
          props: schema.elements[element.id]!.props,
          material,
          parents,
        });
      }}
      renderDropIndicator={renderDropIndicator}
    />
  );
  return renderElement
    ? renderElement({
        children: content,
        elementProps: { ...element.props, 'data-element-id': element.id },
        material,
      })
    : content;
};
const ElementWrapper = ({
  element,
  material,
  select,
  renderDropIndicator,
}: { element: DesignElementProps; material: Material; select: (event: MouseEvent) => void } & Pick<
  CanvasProps,
  'renderDropIndicator'
>): ReactNode => {
  const { setNodeRef } = useDroppable({ id: element.id, data: { id: element.id, material } });
  // The shared Runtime layout node owns geometry in both design and run modes.
  return element.renderMaterial(
    {
      om_readonly: true,
      ...(material.acceptsChildren
        ? {
            om_dropPlaceholder: (
              <Placeholder
                element={element}
                material={material}
                select={select}
                renderDropIndicator={renderDropIndicator}
              />
            ),
          }
        : {}),
    },
    { ref: setNodeRef, onClick: select },
  );
};
const Placeholder = ({
  element,
  material,
  select,
  renderDropIndicator,
}: { element: DesignElementProps; material: Material; select: (event: MouseEvent) => void } & Pick<
  CanvasProps,
  'renderDropIndicator'
>): React.JSX.Element => {
  const { setNodeRef, isOver } = useDroppable({
    id: `${element.id}-placeholder`,
    data: { id: element.id, material },
  });
  return (
    <div ref={setNodeRef} onClick={select} className='size-full min-h-20'>
      {renderDropIndicator?.({ material, isDragOver: isOver }) ?? '请拖入物料'}
    </div>
  );
};
