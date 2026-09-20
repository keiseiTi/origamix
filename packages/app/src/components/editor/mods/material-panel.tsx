import { Draggable, type Material } from '@tangramino/base-editor';

export interface MaterialGroup {
  title: string;
  children: Material[];
}

export const MaterialPanel = ({ groups }: { groups: MaterialGroup[] }): React.JSX.Element => {
  return (
    <div className='size-full overflow-auto select-none' aria-label='物料面板'>
      {groups.map((group) => (
        <details
          key={group.title}
          open
          className='border-b border-zinc-200 dark:border-zinc-800'
        >
          <summary className='cursor-pointer px-2 py-1.5 text-sm font-medium select-none hover:bg-zinc-50 dark:hover:bg-zinc-900'>
            {group.title}
          </summary>
          <div className='flex flex-wrap gap-3 p-2 pt-1.5'>
            {group.children.map((material) => (
              <Draggable key={material.type} material={material}>
                <div className='flex h-8 w-25 cursor-grab items-center justify-center rounded-sm border border-zinc-400 bg-white px-2 text-center text-xs hover:bg-zinc-100 active:cursor-grabbing dark:border-zinc-600 dark:bg-zinc-950 dark:hover:bg-zinc-800'>
                  {material.title}
                </div>
              </Draggable>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
};
