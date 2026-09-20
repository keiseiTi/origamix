import { Button } from '@heroui/react';
import { Ellipsis, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface SidebarActionMenuProps {
  label: string;
  onRename: () => void;
  onDelete: () => void;
}

interface MenuPosition {
  left: number;
  top: number;
}

const menuWidth = 144;
const menuHeight = 80;
const viewportGap = 8;

export const SidebarActionMenu = ({
  label,
  onRename,
  onDelete,
}: SidebarActionMenuProps): React.JSX.Element => {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const isOpen = position !== null;

  const closeMenu = (restoreFocus = false): void => {
    setPosition(null);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const toggleMenu = (): void => {
    if (isOpen) return closeMenu(true);

    const bounds = triggerRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const left = Math.min(
      window.innerWidth - menuWidth - viewportGap,
      Math.max(viewportGap, bounds.right - menuWidth),
    );
    const below = bounds.bottom + 4;
    const top =
      below + menuHeight <= window.innerHeight - viewportGap
        ? below
        : Math.max(viewportGap, bounds.top - menuHeight - 4);

    setPosition({ left, top });
  };

  const runAction = (action: () => void): void => {
    closeMenu();
    action();
  };

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) closeMenu();
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closeMenu(true);
    };
    const handleScroll = (): void => closeMenu();

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScroll);
    window.addEventListener('scroll', handleScroll, true);
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScroll);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  return (
    <>
      <Button
        ref={triggerRef}
        isIconOnly
        size='sm'
        variant='ghost'
        className={`h-6 min-h-6 w-6 min-w-6 hover:bg-zinc-200 focus-visible:opacity-100 dark:hover:bg-zinc-800 ${
          isOpen
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
        }`}
        aria-label={label}
        aria-haspopup='menu'
        aria-expanded={isOpen}
        onPress={toggleMenu}
      >
        <Ellipsis size={15} />
      </Button>
      {position &&
        createPortal(
          <div
            ref={menuRef}
            role='menu'
            aria-label={label}
            className='fixed z-50 w-36 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900'
            style={position}
          >
            <button
              type='button'
              role='menuitem'
              className='flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs text-zinc-700 outline-none hover:bg-zinc-100 focus-visible:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800'
              onClick={() => runAction(onRename)}
            >
              <Pencil size={13} />
              编辑
            </button>
            <button
              type='button'
              role='menuitem'
              className='flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs text-danger outline-none hover:bg-danger/10 focus-visible:bg-danger/10'
              onClick={() => runAction(onDelete)}
            >
              <Trash2 size={13} />
              删除
            </button>
          </div>,
          document.body,
        )}
    </>
  );
};
