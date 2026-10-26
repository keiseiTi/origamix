import { useMemo, type ReactNode, type CSSProperties, type MouseEvent } from 'react';
import { DesignRenderer, type DesignElementProps } from '@origamix/runtime';
import { useDroppable, useDraggable, DragOverlay as DndDragOverlay } from '@dnd-kit/core';
import type { Material } from '../core/material';
import { useEditorCore } from '../core/session';
import { SchemaUtils } from '../core/schema';
import { CanvasOverlay } from './overlay';

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
      <CanvasOverlay renderContent={renderOverlayContent} />
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
  const extra = {
    om_readonly: true,
    onClick: select,
    ...(material.isContainer
      ? {
          ref: setNodeRef,
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
  };
  // eslint-disable-next-line react-hooks/refs -- renderMaterial forwards this callback ref as a React prop; it never reads a ref value.
  if (material.isContainer) return element.renderMaterial(extra);
  return (
    <div
      ref={setNodeRef}
      className={material.isBlock ? 'block' : 'inline-block align-top'}
      onClick={select}
    >
      {element.renderMaterial({ om_readonly: true })}
    </div>
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
export const Draggable = ({
  material,
  children,
  className,
  style,
}: {
  material: Material;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}): React.JSX.Element => {
  const { setNodeRef, listeners, attributes } = useDraggable({
    id: `${material.type}-draggable`,
    data: material,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={className}
      style={{ ...style, touchAction: 'none' }}
    >
      {children}
    </div>
  );
};
export const Movable = ({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
}): React.JSX.Element => {
  const active = useEditorCore((state) => state.activeElement);
  const { setNodeRef, listeners, attributes } = useDraggable({
    id: `${active?.id}-move`,
    data: active ?? undefined,
    disabled: !active,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={className}
      style={{ touchAction: 'none' }}
    >
      {children}
    </div>
  );
};
export const DragOverlay = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const drag = useEditorCore((state) => state.dragElement);
  return <DndDragOverlay dropAnimation={null}>{drag ? children : null}</DndDragOverlay>;
};
