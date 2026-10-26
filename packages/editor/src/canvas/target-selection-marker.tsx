import type { EnhancedComponentProps } from './canvas-editor';
import { useTargetSelection } from './target-selection-context';

export const TargetSelectionMarker = ({
  children,
  elementProps,
  material,
}: EnhancedComponentProps): React.JSX.Element => {
  const elementId = elementProps['data-element-id'];
  const selection = useTargetSelection();
  const candidateIndex =
    selection?.candidates.findIndex((candidate) => candidate.elementId === elementId) ?? -1;
  const isCandidate = candidateIndex >= 0;

  if (typeof elementId !== 'string' || (material.isContainer && !isCandidate)) return children;

  return (
    <div
      data-element-id={elementId}
      className={`${material.isBlock || material.isContainer ? 'block w-full' : 'inline-block align-top'} relative ${isCandidate ? (selection?.highlightedElementId === elementId ? 'ring-2 ring-blue-500 ring-offset-2' : 'ring-1 ring-blue-400/70') : ''}`}
    >
      {children}
      {isCandidate && (
        <button
          type='button'
          disabled={selection?.disabled}
          className='absolute -top-2 -right-2 z-10 grid size-5 place-items-center rounded-full bg-blue-600 text-[10px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
          aria-label={`选择目标 ${selection?.candidates[candidateIndex]?.label ?? elementId}`}
          onClick={(event) => {
            event.stopPropagation();
            if (!selection?.disabled) selection?.onSelect(elementId);
          }}
        >
          {String.fromCharCode(65 + candidateIndex)}
        </button>
      )}
    </div>
  );
};
