import type { DropPlaceholderProps } from './canvas-editor';

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
