import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EnhancedComponentProps } from './canvas-editor';
import { useTargetSelection } from './target-selection-context';
import { useEditorCore } from '../session/editor-session';

/** Candidate decorations never participate in the material's layout. */
export const TargetSelectionMarker = ({
  children,
  elementProps,
}: EnhancedComponentProps): React.JSX.Element => {
  const elementId = elementProps['data-element-id'];
  const selection = useTargetSelection();
  const canvasRoot = useEditorCore((state) => state.canvasRoot);
  const candidateIndex =
    selection?.candidates.findIndex((item) => item.elementId === elementId) ?? -1;
  const [rect, setRect] = useState<{
    id: string;
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  useEffect(() => {
    if (candidateIndex < 0 || typeof elementId !== 'string' || !canvasRoot) return;
    let frame: number;
    const update = () => {
      const node = canvasRoot.querySelector(`[data-element-id="${CSS.escape(elementId)}"]`);
      const next = node?.getBoundingClientRect();
      setRect((previous) =>
        !next || !next.width || !next.height
          ? null
          : previous?.id === elementId &&
              previous.left === next.left &&
              previous.top === next.top &&
              previous.width === next.width &&
              previous.height === next.height
            ? previous
            : {
                id: elementId,
                left: next.left,
                top: next.top,
                width: next.width,
                height: next.height,
              },
      );
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [candidateIndex, elementId, canvasRoot]);
  const candidate = typeof elementId === 'string' && candidateIndex >= 0 && rect?.id === elementId;
  return (
    <>
      {children}
      {candidate &&
        createPortal(
          <div
            className={`pointer-events-none fixed z-[998] ring-2 ${selection?.highlightedElementId === elementId ? 'ring-blue-500' : 'ring-blue-400/70'}`}
            style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
          >
            <button
              type='button'
              disabled={selection?.disabled}
              className='pointer-events-auto absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-blue-600 text-[10px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
              aria-label={`选择目标 ${selection?.candidates[candidateIndex]?.label ?? elementId}`}
              onClick={(event) => {
                event.stopPropagation();
                if (!selection?.disabled) selection?.onSelect(elementId);
              }}
            >
              {String.fromCharCode(65 + candidateIndex)}
            </button>
          </div>,
          canvasRoot?.ownerDocument.body ?? document.body,
        )}
    </>
  );
};
