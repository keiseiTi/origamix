import { getElementLabel } from '@origamix/shared';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@origamix/ui';
import { Move, Trash2 } from 'lucide-react';
import { Movable } from './canvas-drag-controls';
import { useEditorCore } from '../session/editor-session';
import { SchemaUtils } from '../schema/schema-utils';

export const SelectionToolbar = (): React.JSX.Element | null => {
  const { activeElement, schema, setSchema, setActiveElement } = useEditorCore();

  if (!activeElement) return null;

  const { id, material } = activeElement;
  const isRoot = schema.layout.root === id;
  const isBlock = material.isBlock || material.isContainer;

  const remove = (): void => {
    if (isRoot) return;
    const nextSchema = SchemaUtils.removeElement(schema, id).schema;
    setSchema(nextSchema);
    setActiveElement(null);
  };

  return (
    <>
      <div
        className={`pointer-events-auto absolute w-max whitespace-nowrap bg-blue-600 px-2 py-1 text-xs text-white shadow-sm ${isBlock ? '-top-7 left-0 rounded-t' : '-bottom-7 right-0 rounded-b'}`}
      >
        {getElementLabel(id, schema.elements[id], String(material.title))}
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
