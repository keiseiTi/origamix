import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useEditorCore } from '../core/session';
import { createPortal } from 'react-dom';

interface CanvasOverlayProps {
  style?: React.CSSProperties | undefined;
  className?: string | undefined;
  renderContent?: (() => React.ReactNode) | undefined;
}

export const CanvasOverlay = (props: CanvasOverlayProps) => {
  const { style, className, renderContent: Content } = props;
  const activeElement = useEditorCore((state) => state.activeElement);
  const canvasRoot = useEditorCore((state) => state.canvasRoot);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastRectRef = useRef<DOMRect | null>(null);

  // 比较两个 DOMRect 是否相同
  const isRectChanged = (rect1: DOMRect | null, rect2: DOMRect | null): boolean => {
    if (rect1 === null && rect2 === null) return false;
    if (rect1 === null || rect2 === null) return true;
    return (
      rect1.left !== rect2.left ||
      rect1.top !== rect2.top ||
      rect1.width !== rect2.width ||
      rect1.height !== rect2.height
    );
  };

  const updateRect = useCallback(() => {
    if (!activeElement) {
      if (isRectChanged(lastRectRef.current, null)) {
        setRect(null);
        lastRectRef.current = null;
      }
      return;
    }

    const element = canvasRoot?.querySelector(
      `[data-element-id="${CSS.escape(activeElement.id)}"]`,
    );
    if (element) {
      const newRect = element.getBoundingClientRect();
      if (isRectChanged(lastRectRef.current, newRect)) {
        setRect(newRect);
        lastRectRef.current = newRect;
      }
    } else {
      if (isRectChanged(lastRectRef.current, null)) {
        setRect(null);
        lastRectRef.current = null;
      }
    }
  }, [activeElement, canvasRoot]);

  // 初始化和选中元素改变时更新
  useEffect(() => {
    updateRect();
  }, [activeElement, updateRect]);

  // 使用 requestAnimationFrame 持续监听尺寸变化
  useEffect(() => {
    if (!activeElement || !canvasRoot) return;
    const animate = () => {
      updateRect();
      rafIdRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);

    rafIdRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [updateRect, activeElement, canvasRoot]);

  if (!rect || !activeElement) return null;

  return createPortal(
    <div className='pointer-events-none fixed inset-0 z-[999]'>
      <div
        style={{
          transform: `translate(${rect.left}px, ${rect.top}px)`,
          width: rect.width,
          height: rect.height,
          ...style,
        }}
        className={`absolute box-border border-2 border-blue-500 transition-all duration-100 ease-out ${className ?? ''}`}
      >
        {Content ? (
          <Content />
        ) : (
          <div className='absolute -top-6 left-0 rounded-t bg-blue-600 px-2 py-0.5 text-xs text-white'>
            {activeElement.material.title}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
