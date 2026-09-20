import { Button } from '../../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';
import {
  Movable,
  useEditorCore,
  usePluginCore,
  type DropPlaceholderProps,
  type EnhancedComponentProps,
} from '@tangramino/base-editor';
import { GripVertical, Move, Trash2 } from 'lucide-react';
import { removeEditorElement } from './editor-schema';

export const DropIndicator = ({
  material,
  isDragOver,
}: DropPlaceholderProps): React.JSX.Element => {
  const containerKind = material.type === 'form' ? '原子物料' : '物料';

  return (
    <div
      className={`flex size-full min-h-20 items-center justify-center px-4 text-xs transition-colors ${isDragOver ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}
    >
      请将{containerKind}拖拽到{material.title}内
    </div>
  );
};

export const EditableElement = ({
  children,
  elementProps,
  material,
}: EnhancedComponentProps): React.JSX.Element => {
  const elementId = elementProps['data-element-id'];

  if (material.isContainer || typeof elementId !== 'string') return children;

  return (
    <div
      data-element-id={elementId}
      className={material.isBlock ? 'block w-full' : 'inline-block align-top'}
    >
      {children}
    </div>
  );
};

export const EditorOverlay = (): React.JSX.Element | null => {
  const { activeElement, schema, setSchema, setActiveElement } = useEditorCore();
  const { callSchemaHook } = usePluginCore();

  if (!activeElement) return null;

  const { id, material } = activeElement;
  const isRoot = schema.layout.root === id;
  const isBlock = material.isBlock || material.isContainer;

  const remove = (): void => {
    if (isRoot) return;
    const parentId = Object.entries(schema.layout.structure).find(([, children]) =>
      children.includes(id),
    )?.[0];
    const index = parentId ? (schema.layout.structure[parentId] ?? []).indexOf(id) : -1;
    const operation = {
      elementId: id,
      parentId: parentId ?? '',
      index,
      element: { id, ...schema.elements[id] },
    };
    if (callSchemaHook('onBeforeRemove', schema, operation) === false) return;
    const nextSchema = removeEditorElement(schema, id);
    callSchemaHook('onAfterRemove', nextSchema, operation);
    setSchema(nextSchema);
    setActiveElement(null);
  };

  return (
    <>
      <div
        className={`pointer-events-auto absolute w-max whitespace-nowrap bg-blue-600 px-2 py-1 text-xs text-white shadow-sm ${isBlock ? '-top-7 left-0 rounded-t' : '-bottom-7 right-0 rounded-b'}`}
      >
        {material.title}
      </div>
      {!isRoot && (
        <div
          className='pointer-events-auto absolute -top-7 right-0 flex h-7 items-center rounded-t bg-blue-600 p-0.5 text-white shadow-sm'
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <Movable className='grid h-6 w-6 cursor-move place-items-center rounded hover:bg-white hover:text-black'>
                  <Move size={14} />
                </Movable>
              }
            />
            <TooltipContent>移动元素</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size='icon-xs'
                  variant='ghost'
                  className='text-white'
                  aria-label='删除元素'
                  onClick={remove}
                />
              }
            >
              <Trash2 size={14} />
            </TooltipTrigger>
            <TooltipContent>删除元素</TooltipContent>
          </Tooltip>
        </div>
      )}
    </>
  );
};
