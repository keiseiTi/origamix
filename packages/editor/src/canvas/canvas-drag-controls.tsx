import type { ReactNode, CSSProperties, MouseEvent } from 'react';
import { useDraggable, DragOverlay as DndDragOverlay } from '@dnd-kit/core';
import type { Material } from '../contracts/material-contracts';
import { useEditorCore } from '../session/editor-session';

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
