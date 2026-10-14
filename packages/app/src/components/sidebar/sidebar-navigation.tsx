import { useImperativeHandle, type ComponentProps, type Ref } from 'react';
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation';
import { Sidebar } from './index';
import { SidebarToggle } from './sidebar-toggle';

export interface SidebarNavigationHandle {
  closePeek: () => void;
  enterEdit: () => void;
  pinOpen: () => void;
}

type SidebarNavigationProps = Omit<ComponentProps<typeof Sidebar>, 'onPin' | 'onTemporaryClose'> & {
  ref?: Ref<SidebarNavigationHandle>;
};

export const SidebarNavigation = ({
  ref,
  ...sidebarProps
}: SidebarNavigationProps): React.JSX.Element => {
  const navigation = useSidebarNavigation();
  const { closePeek, enterEdit, pinOpen } = navigation;
  useImperativeHandle(ref, () => ({ closePeek, enterEdit, pinOpen }), [
    closePeek,
    enterEdit,
    pinOpen,
  ]);

  return (
    <>
      {navigation.visible && (
        <Sidebar {...sidebarProps} onPin={pinOpen} onTemporaryClose={closePeek} />
      )}
      <SidebarToggle
        peek={navigation.peek}
        onCollapse={navigation.collapse}
        onPinOpen={pinOpen}
        onMouseEnter={navigation.onToggleMouseEnter}
        onMouseLeave={navigation.onToggleMouseLeave}
      />
    </>
  );
};
