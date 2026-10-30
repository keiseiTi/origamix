import { getInsertionAxis } from '../canvas/layout-axis';
import {
  useCallback,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CanvasEditor } from '../canvas/canvas-editor';
import { DragOverlay } from '../canvas/canvas-drag-controls';
import { EditorProvider } from '../session/editor-provider';
import { useEditorCore, useEditorStoreApi } from '../session/editor-session';
import { SchemaUtils } from '../schema/schema-utils';
import { type OrigamixPageSchema as Schema } from '@origamix/shared';
import { TooltipProvider } from '@origamix/ui';
import type { OrigamixPageSchema } from '@origamix/shared';
import type { EditorMaterialRegistration } from '../contracts/editor-contracts';
import { DropIndicator } from '../canvas/drop-indicator';
import { TargetSelectionMarker } from '../canvas/target-selection-marker';
import { SelectionToolbar } from '../canvas/selection-toolbar';
import { InsertPositionIndicator } from '../canvas/insert-position-indicator';

export type CanvasPrototypeCommand =
  | { kind: 'select'; id: string }
  | { kind: 'update'; id: string; field: string; value: string }
  | { kind: 'add'; materialType: string; x: number; y: number }
  | { kind: 'hover'; x: number; y: number }
  | { kind: 'cancel' | 'undo' | 'redo' | 'snapshot' };
export interface CanvasPrototypeSnapshot {
  schema: OrigamixPageSchema;
  selectedId: string | null;
  canUndo: boolean;
  canRedo: boolean;
}
export interface CanvasPrototypeHandle {
  run: (command: CanvasPrototypeCommand) => CanvasPrototypeSnapshot;
}
interface Props {
  schema: OrigamixPageSchema;
  registration: EditorMaterialRegistration;
  onSnapshot: (snapshot: CanvasPrototypeSnapshot) => void;
}
const Surface = forwardRef<CanvasPrototypeHandle, Omit<Props, 'schema'>>(
  ({ registration, onSnapshot }, ref) => {
    const schema = useEditorCore((state) => state.schema);
    const selected = useEditorCore((state) => state.activeElement?.id ?? null);
    const store = useEditorStoreApi();
    const history = store.getState();
    const viewport = useRef<HTMLDivElement>(null);
    const [marker, setMarker] = useState<{
      x: number;
      y: number;
      width: number;
      height: number;
    } | null>(null);
    const snapshot = useCallback(
      (): CanvasPrototypeSnapshot => ({
        schema: store.getState().schema as OrigamixPageSchema,
        selectedId: (() => {
          const state = store.getState();
          const id = state.activeElement?.id;
          return id && Object.hasOwn(state.schema.elements, id) ? id : null;
        })(),
        canUndo: store.getState().canUndo,
        canRedo: store.getState().canRedo,
      }),
      [store],
    );
    const locate = (x: number, y: number) => {
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) throw new Error('落点在画布之外');
      const state = store.getState();
      const hit = document
        .elementsFromPoint(x, y)
        .map((node) => node.closest<HTMLElement>('[data-element-id]'))
        .find((node) => node && state.schema.elements[node.dataset.elementId!]);
      if (!hit) throw new Error('请放入页面容器');
      const id = hit.dataset.elementId!;
      const material = state.materials.find(
        (item) => item.type === state.schema.elements[id]!.type,
      );
      const rect = hit.getBoundingClientRect();
      const inside = Boolean(material?.acceptsChildren);
      const vertical =
        getInsertionAxis(state.schema, state.materials, id, state.canvasRoot) === 'vertical';
      const position = vertical
        ? y < rect.top + rect.height / 2
          ? 'up'
          : 'down'
        : x < rect.left + rect.width / 2
          ? 'before'
          : 'after';
      const parent = inside
        ? id
        : Object.entries(state.schema.layout.structure).find(([, children]) =>
            children.includes(id),
          )?.[0];
      if (!parent) throw new Error('落点没有可用父容器');
      return { id, parent, inside, position, rect } as const;
    };
    useImperativeHandle(ref, () => ({
      run: (command) => {
        const state = store.getState();
        if (command.kind === 'undo') history?.undo();
        else if (command.kind === 'redo') history?.redo();
        else if (command.kind === 'cancel') setMarker(null);
        else if (command.kind === 'select') {
          const element = state.schema.elements[command.id];
          const material = state.materials.find((item) => item.type === element?.type);
          if (!element || !material) throw new Error('元素不存在');
          state.setActiveElement({ ...element, id: command.id, material });
        } else if (command.kind === 'update') {
          const element = state.schema.elements[command.id];
          if (
            !element ||
            !(
              (element.type === 'button' && command.field === 'text') ||
              (element.type === 'input' && command.field === 'placeholder')
            )
          )
            throw new Error('原型只允许修改按钮文本与输入提示');
          const result = SchemaUtils.setElementProps(state.schema, command.id, {
            [command.field]: command.value,
          });
          state.setSchema(result.schema);
        } else if (command.kind === 'add' || command.kind === 'hover') {
          const area = viewport.current;
          if (area && command.kind === 'hover') {
            const bounds = area.getBoundingClientRect();
            area.scrollBy(
              0,
              command.y > bounds.bottom - 40 ? 16 : command.y < bounds.top + 40 ? -16 : 0,
            );
          }
          const hit = locate(command.x, command.y);
          if (command.kind === 'hover')
            setMarker({
              x: hit.position === 'after' ? hit.rect.right : hit.rect.left,
              y: hit.inside
                ? Math.min(innerHeight - 4, hit.rect.bottom - 3)
                : hit.position === 'down'
                  ? hit.rect.bottom
                  : hit.rect.top,
              width:
                !hit.inside && (hit.position === 'before' || hit.position === 'after')
                  ? 4
                  : hit.rect.width,
              height:
                !hit.inside && (hit.position === 'before' || hit.position === 'after')
                  ? hit.rect.height
                  : 4,
            });
          else {
            setMarker(null);
            const material = state.materials.find((item) => item.type === command.materialType);
            const manifest = registration.catalog.materials.find(
              (item) => item.type === command.materialType,
            );
            if (
              !material ||
              !['button', 'input'].includes(material.type) ||
              (manifest?.allowedParentTypes &&
                !manifest.allowedParentTypes.includes(state.schema.elements[hit.parent]!.type))
            )
              throw new Error('物料不允许放入该容器');
            const element = {
              id: `prototype_${crypto.randomUUID()}`,
              type: material.type,
              props: structuredClone(material.defaultProps ?? {}),
            };
            const result = hit.inside
              ? SchemaUtils.insertElement(state.schema, hit.id, element)
              : SchemaUtils.insertAdjacentElement(state.schema, hit.id, element, hit.position);
            state.setSchema(result.schema);
          }
        }
        return snapshot();
      },
    }));
    useEffect(() => {
      onSnapshot(snapshot());
    }, [schema, selected, onSnapshot, snapshot]);
    return (
      <div
        ref={viewport}
        className='relative h-screen overflow-auto bg-white p-6'
        aria-label='隔离编辑画布'
        onClickCapture={(event) => {
          if ((event.target as HTMLElement).closest('a,button')) event.preventDefault();
        }}
      >
        <CanvasEditor
          className='relative min-h-full'
          renderDropIndicator={DropIndicator}
          renderElement={TargetSelectionMarker}
          renderOverlayContent={SelectionToolbar}
        />
        <DragOverlay>
          <div className='rounded border border-blue-500 bg-white px-3 py-2 text-xs text-blue-700'>
            移动物料
          </div>
        </DragOverlay>
        <InsertPositionIndicator />
        {marker && (
          <div
            className='pointer-events-none fixed z-50 h-1 bg-blue-600'
            style={{ left: marker.x, top: marker.y, width: marker.width, height: marker.height }}
          />
        )}
      </div>
    );
  },
);

/** Experimental surface: one frame owns the engine/history; no persistence or host authority. */
export const CanvasPrototypeSurface = forwardRef<CanvasPrototypeHandle, Props>(
  ({ schema, registration, onSnapshot }, ref) => {
    const materials = useMemo(
      () => [
        ...(registration.rootMaterials ?? []),
        ...registration.groups.flatMap((group) => group.children),
      ],
      [registration],
    );
    return (
      <TooltipProvider>
        <EditorProvider schema={schema as Schema} materials={materials}>
          <Surface ref={ref} registration={registration} onSnapshot={onSnapshot} />
        </EditorProvider>
      </TooltipProvider>
    );
  },
);
