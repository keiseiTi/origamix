import { useEditorCore } from '@tangramino/base-editor';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function InsertPositionIndicator(): React.JSX.Element | null {
  const insertPosition = useEditorCore((state) => state.insertPosition);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const frameRef = useRef<number | null>(null);

  const updateRect = useCallback((): void => {
    if (!insertPosition) {
      setRect(null);
      return;
    }

    const selector = `[data-element-id="${CSS.escape(insertPosition.id)}"]`;
    setRect(document.querySelector(selector)?.getBoundingClientRect() ?? null);
  }, [insertPosition]);

  useEffect(() => {
    const update = (): void => {
      updateRect();
      frameRef.current = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [updateRect]);

  if (!rect || !insertPosition) return null;

  const vertical = insertPosition.position === 'before' || insertPosition.position === 'after';
  const lineStyle: React.CSSProperties = vertical
    ? {
        left: (insertPosition.position === 'before' ? rect.left : rect.right) - 2,
        top: rect.top,
        width: 4,
        height: rect.height,
      }
    : {
        left: rect.left,
        top: (insertPosition.position === 'up' ? rect.top : rect.bottom) - 2,
        width: rect.width,
        height: 4,
      };

  return createPortal(
    <div className='pointer-events-none fixed inset-0 z-[9998]' aria-hidden='true'>
      <div
        className='absolute rounded-sm bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.85)]'
        style={lineStyle}
      />
    </div>,
    document.body,
  );
}
