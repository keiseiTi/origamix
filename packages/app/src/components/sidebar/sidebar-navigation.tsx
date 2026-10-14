import { useImperativeHandle, type ComponentProps, type Ref } from 'react';
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation';
import { Sidebar } from './index';
import { SidebarToggle } from './sidebar-toggle';

export interface SidebarNavigationHandle {
  closePeek: () => void;
}

type SidebarNavigationProps = Omit<ComponentProps<typeof Sidebar>, 'onPin' | 'onTemporaryClose'> & {
  ref?: Ref<SidebarNavigationHandle>;
};

export const SidebarNavigation = ({
  ref,
  ...sidebarProps
}: SidebarNavigationProps): React.JSX.Element => {
  const navigation = useSidebarNavigation();
  const { closePeek, pinOpen } = navigation;
  useImperativeHandle(ref, () => ({ closePeek }), [closePeek]);

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
