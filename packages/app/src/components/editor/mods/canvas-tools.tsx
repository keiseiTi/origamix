import { Button, Tooltip } from '@heroui/react';
import {
  Movable,
  useEditorCore,
  type DropPlaceholderProps,
  type EnhancedComponentProps,
} from '@tangramino/base-editor';
import { GripVertical, Trash2 } from 'lucide-react';
import { removeEditorElement } from './editor-schema';

export function DropIndicator({ material, isDragOver }: DropPlaceholderProps): React.JSX.Element {
  return (
    <div
      className={`grid size-full min-h-20 place-items-center rounded-md border border-dashed px-4 text-xs transition-colors ${isDragOver ? 'border-blue-500 bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' : 'border-zinc-300 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'}`}
    >
      将物料拖入“{material.title}”
    </div>
  );
}

export function EditableElement({ children }: EnhancedComponentProps): React.JSX.Element {
  return children;
}

export function EditorOverlay(): React.JSX.Element | null {
  const { activeElement, schema, setSchema, setActiveElement } = useEditorCore();

  if (!activeElement) return null;

  const { id, material } = activeElement;
  const isRoot = schema.layout.root === id;

  const remove = (): void => {
    if (isRoot) return;
    setSchema(removeEditorElement(schema, id));
    setActiveElement(null);
  };

  return (
    <>
      <div className='pointer-events-auto absolute -top-7 left-0 max-w-[calc(100%-3.5rem)] truncate rounded-t bg-blue-600 px-2 py-1 text-xs text-white shadow-sm'>
        {material.title}
      </div>
      {!isRoot && (
        <div
          className='pointer-events-auto absolute -top-7 right-0 flex h-7 items-center rounded-t bg-blue-600 p-0.5 text-white shadow-sm'
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <Tooltip>
            <Movable className='grid h-6 w-6 cursor-move place-items-center rounded hover:bg-white/15'>
              <GripVertical size={14} />
            </Movable>
            <Tooltip.Content>移动元素</Tooltip.Content>
          </Tooltip>
          <Tooltip>
            <Button
              isIconOnly
              size='sm'
              variant='ghost'
              className='h-6 min-h-6 w-6 min-w-6 text-white hover:bg-white/15'
              aria-label='删除元素'
              onPress={remove}
            >
              <Trash2 size={13} />
            </Button>
            <Tooltip.Content>删除元素</Tooltip.Content>
          </Tooltip>
        </div>
      )}
    </>
  );
}
