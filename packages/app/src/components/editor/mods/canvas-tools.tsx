import { Button, Tooltip } from '@heroui/react';
import {
  Movable,
  useEditorCore,
  type DropPlaceholderProps,
  type EnhancedComponentProps,
} from '@tangramino/base-editor';
import { SchemaUtils } from '@tangramino/engine';
import { GripVertical, Trash2 } from 'lucide-react';

export function DropIndicator({ material, isDragOver }: DropPlaceholderProps): React.JSX.Element {
  return (
    <div
      className={`grid size-full min-h-20 place-items-center rounded-md border border-dashed px-4 text-xs transition-colors ${isDragOver ? 'border-blue-500 bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' : 'border-zinc-300 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'}`}
    >
      将物料拖入“{material.title}”
    </div>
  );
}

export function EditableElement({
  children,
  elementProps,
  material,
}: EnhancedComponentProps): React.JSX.Element {
  const { activeElement, schema, setSchema, setActiveElement } = useEditorCore();
  const elementId = String(elementProps['data-element-id'] ?? '');
  const selected = activeElement?.id === elementId;
  const isRoot = schema.layout.root === elementId;

  const remove = (): void => {
    if (isRoot) return;
    // @ts-expect-error not-check
    setSchema(SchemaUtils.removeElement(schema, elementId));
    setActiveElement(null);
  };

  return (
    <div
      className={`${material.isContainer ? 'block' : 'inline-block'} relative ${
        selected ? 'outline-2 outline-offset-1 outline-blue-500' : ''
      }`}
    >
      {children}
      {selected && !isRoot && (
        <div
          className='absolute -top-8 right-0 z-20 flex h-7 items-center rounded-md bg-blue-600 p-0.5 text-white shadow-sm'
          onClick={(event) => event.stopPropagation()}
        >
          <Tooltip>
            <Movable
              // @ts-expect-error not-check
              elementId={elementId}
              elementProps={elementProps}
              material={material}
              className='grid h-6 w-6 cursor-move place-items-center rounded hover:bg-white/15'
            >
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
    </div>
  );
}
