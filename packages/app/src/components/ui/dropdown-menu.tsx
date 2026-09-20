import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import { cn } from 'cn';

const DropdownMenu = (props: MenuPrimitive.Root.Props) => <MenuPrimitive.Root {...props} />;

const DropdownMenuTrigger = (props: MenuPrimitive.Trigger.Props) => (
  <MenuPrimitive.Trigger data-slot='dropdown-menu-trigger' {...props} />
);

const DropdownMenuContent = ({
  className,
  side = 'bottom',
  sideOffset = 4,
  align = 'end',
  alignOffset = 0,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'>) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.Positioner
      side={side}
      sideOffset={sideOffset}
      align={align}
      alignOffset={alignOffset}
      className='isolate z-50'
    >
      <MenuPrimitive.Popup
        data-slot='dropdown-menu-content'
        className={cn(
          'min-w-36 origin-(--transform-origin) rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Positioner>
  </MenuPrimitive.Portal>
);

const DropdownMenuItem = ({
  className,
  variant = 'default',
  ...props
}: MenuPrimitive.Item.Props & { variant?: 'default' | 'destructive' }) => (
  <MenuPrimitive.Item
    data-slot='dropdown-menu-item'
    data-variant={variant}
    className={cn(
      'flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive/10 data-[variant=destructive]:data-highlighted:text-destructive [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0',
      className,
    )}
    {...props}
  />
);

export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger };
