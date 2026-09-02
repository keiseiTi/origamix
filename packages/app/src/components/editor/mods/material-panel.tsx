import { Draggable, type Material } from '@tangramino/base-editor';
import { Boxes } from 'lucide-react';

export interface MaterialGroup {
  title: string;
  children: Material[];
}

export function MaterialPanel({ groups }: { groups: MaterialGroup[] }): React.JSX.Element {
  return (
    <aside
      className='flex w-58 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'
      aria-label='物料面板'
    >
      <div className='flex h-10 items-center gap-2 border-b border-zinc-200 px-3 text-xs font-semibold dark:border-zinc-800'>
        <Boxes size={15} />
        物料
      </div>
      <div className='min-h-0 flex-1 overflow-auto p-2'>
        {groups.map((group) => (
          <details
            key={group.title}
            open
            className='mb-2 rounded-lg border border-zinc-200 dark:border-zinc-800'
          >
            <summary className='cursor-pointer select-none px-3 py-2 text-xs font-medium'>
              {group.title}
            </summary>
            <div className='grid grid-cols-2 gap-2 border-t border-zinc-200 p-2 dark:border-zinc-800'>
              {group.children.map((material) => (
                <Draggable key={material.type} material={material}>
                  <div className='flex h-9 cursor-grab items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 px-2 text-center text-xs hover:border-blue-400 hover:bg-blue-50 active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-blue-600 dark:hover:bg-blue-950/30'>
                    {material.title}
                  </div>
                </Draggable>
              ))}
            </div>
          </details>
        ))}
      </div>
    </aside>
  );
}
