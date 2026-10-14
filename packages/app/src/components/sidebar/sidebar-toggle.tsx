import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { usePreferencesStore } from '@/store/preferences';
import { isMacDesktop } from '@/utils';

const macDesktop = isMacDesktop();

export const SidebarToggle = ({
  peek,
  onCollapse,
  onPinOpen,
  onMouseEnter,
  onMouseLeave,
}: {
  peek: boolean;
  onCollapse: () => void;
  onPinOpen: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}): React.JSX.Element => {
  const collapsed = usePreferencesStore((state) => state.sidebarCollapsed);

  return (
    <button
      type='button'
      className={`window-no-drag-region fixed top-1.5 z-30 h-7 min-h-7 w-7 min-w-7 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${
        macDesktop ? 'left-21' : 'left-1.5'
      } grid cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-primary`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={collapsed ? onPinOpen : onCollapse}
      aria-expanded={!collapsed || peek}
      aria-controls='project-sidebar'
      aria-label={collapsed ? (peek ? '固定展开侧边栏' : '展开侧边栏') : '收起侧边栏'}
    >
      {collapsed ? <PanelLeft size={17} /> : <PanelLeftClose size={17} />}
    </button>
  );
};
